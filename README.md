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

If you previously stored a `username` field on users, drop that field or migrate documents; new users are identified by **email** only.

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

**Login** and **email** fields on the user are compared case-insensitively (normalized like registration).

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
| `400` | Missing fields or password does not meet [rules](#password-rules) |
| `409` | Email already registered |

---

#### `POST /api/auth/login`

Obtain a JWT for subsequent requests. **Login uses email + password.**

**Body**

| Field | Type | Required |
|-------|------|----------|
| `email` | string | yes |
| `password` | string | yes |

**Response `200`**

```json
{
  "token": "<jwt>",
  "user": {
    "id": "<ObjectId>",
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
| `400` | Missing email or password |
| `401` | Invalid credentials |
| `500` | `JWT_SECRET` not configured |

Use the `token` value as: `Authorization: Bearer <token>`. The token payload includes `email` and `role` for authorization in the client or future middleware.

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

Update the authenticated user (profile fields, email, and/or password). **`role` is not updated here** (except via explicit error if sent). **Requires authentication.**

**Headers:** `Authorization: Bearer <token>`

**Body** (all fields optional; send only what you want to change)

| Field | Type | Notes |
|-------|------|--------|
| `firstName` | string | |
| `lastName` | string | |
| `email` | string | New email (unique) |
| `currentPassword` | string | Required if `newPassword` is sent |
| `newPassword` | string | Must meet [Password rules](#password-rules) |

**Response `200`**

```json
{
  "user": {
    "id": "<ObjectId>",
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
| `409` | Email already in use |

---

#### `PATCH /api/users/:id`

Update a user by ID. **Requires authentication.**

- **Same user** (`:id` matches the authenticated user): same body and rules as [`PATCH /api/users/me`](#patch-apiusersme) (including `currentPassword` when changing your own password). You cannot change your own `role` through this API.
- **Admin** (`role` is `admin` in the JWT): may update **any** user. For **another** user, you may set `role` and may set `newPassword` **without** `currentPassword` (password reset). Admins changing **their own** password still must send `currentPassword`.

**Headers:** `Authorization: Bearer <token>`

**URL params**

| Param | Description |
|-------|-------------|
| `id` | MongoDB ObjectId of the user to update |

**Body** (all optional; send only fields to change)

| Field | Type | Notes |
|-------|------|--------|
| `firstName` | string | |
| `lastName` | string | |
| `email` | string | Unique |
| `role` | string | **Admin only**, and **only when updating another user** (`:id` ≠ you). One of: `guest`, `cashier`, `frontdesk`, `admin`, `housekeeping` |
| `currentPassword` | string | Required when **you** set `newPassword` (same account) |
| `newPassword` | string | [Password rules](#password-rules). For **non-admin** targets, only the user themself can set it (with `currentPassword`). **Admin** may set another user’s password without `currentPassword`. |

**Response `200`** — same `user` shape as `PATCH /me`.

**Errors**

| Status | When |
|--------|------|
| `400` | Invalid `id`, invalid `role`, or validation failed |
| `401` | Missing/invalid token or wrong `currentPassword` (when required) |
| `403` | Not allowed to update this user (not self and not admin) |
| `404` | User not found |
| `409` | Email conflict |

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

{"email":"user@example.com","password":"Yourpass1!"}
```

```http
GET /api/users/me
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Other responses

- **`404`** — Unknown route: `{ "error": "Not found" }`
- **`500`** — Unhandled server error: `{ "error": "Internal server error" }` (or a specific message when thrown intentionally)
