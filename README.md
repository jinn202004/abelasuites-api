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
- [Room endpoints](#room-endpoints)
- [Event venue endpoints](#event-venue-endpoints)
- [Booking endpoints](#booking-endpoints)
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

### Room endpoints

**Read:** `GET /api/rooms` and `GET /api/rooms/:id` are **public** (no auth) so guests can browse the catalog.

**Write:** `POST`, `PATCH`, and `DELETE` require **Bearer auth** and **admin role**.

**Room object**

```json
{
  "id": "<ObjectId>",
  "title": "Deluxe King Room",
  "roomNumber": "101",
  "package": "Overnight",
  "image": "https://...",
  "price": 3500,
  "guests": 2,
  "description": "Spacious room with balcony",
  "features": ["WiFi", "Aircon", "TV"],
  "createdAt": "<ISO date>",
  "updatedAt": "<ISO date>"
}
```

#### `GET /api/rooms`

Returns all rooms sorted by `roomNumber`. **No auth.**

**200** — `{ "rooms": [Room, ...] }`

#### `GET /api/rooms/:id`

Get a single room by id. **No auth.**

**200** — `{ "room": Room }`

**Errors:** `400` invalid id, `404` not found.

#### `POST /api/rooms`

Create a room. **Auth:** Bearer + admin.

**Body**

| Field | Required | Notes |
|-------|----------|--------|
| `title` | yes | non-empty string |
| `roomNumber` | yes | unique string |
| `price` | yes | number (accepts numeric strings; currency symbols, commas, spaces are stripped) |
| `guests` | yes | positive integer |
| `package` | no | string |
| `image` | no | string URL/path |
| `description` | no | string |
| `features` | no | array of strings |

**201** — `{ "room": Room }`

**Errors:** `400` validation, `409` duplicate `roomNumber`.

#### `PATCH /api/rooms/:id`

Partial update for any room fields in the create payload.

**200** — `{ "room": Room }`

**Errors:** `400` invalid id/validation, `404` not found, `409` duplicate `roomNumber`.

#### `DELETE /api/rooms/:id`

Delete a room.

**200** — `{ "room": Room, "deleted": true }`

**Errors:** `400` invalid id, `404` not found.

---

### Event venue endpoints

All `/api/event-venues` routes require **Bearer auth** and **admin role**.

**Event venue object**

```json
{
  "id": "<ObjectId>",
  "eventNum": "EV-001",
  "name": "Grand Ballroom",
  "package": "Wedding",
  "type": "Event",
  "limit": "100-150 pax",
  "capacity": 150,
  "price": 50000,
  "location": "2nd Floor",
  "description": "Spacious indoor hall",
  "features": ["Sound system", "Lighting"],
  "amenities": ["Sound system", "Lighting"],
  "housekeeping": ["Post-event cleanup"],
  "image": "https://...",
  "createdAt": "<ISO date>",
  "updatedAt": "<ISO date>"
}
```

#### `GET /api/event-venues`

Returns all venues sorted by `eventNum`.

**200** — `{ "eventVenues": [EventVenue, ...] }`

#### `GET /api/event-venues/:id`

Get one venue by id.

**200** — `{ "eventVenue": EventVenue }`

**Errors:** `400` invalid id, `404` not found.

#### `POST /api/event-venues`

Create a venue.

**Body** (required fields on create)

| Field | Required | Notes |
|-------|----------|--------|
| `eventNum` | yes | unique string |
| `name` | yes | |
| `package` | yes | |
| `limit` | yes | display text e.g. `20-30 guests` |
| `price` | yes | number (numeric strings accepted; currency symbols/commas/spaces stripped) |
| `location` | yes | |
| `description` | yes | |
| `image` | yes | URL/path |
| `features` or `amenities` | yes | at least one entry |
| `type` | no | defaults to `Event` |
| `capacity` | no | positive integer |
| `housekeeping` | no | array of strings |

**201** — `{ "eventVenue": EventVenue }`

**Errors:** `400` validation (may include `missing` list), `409` duplicate `eventNum`.

#### `PATCH /api/event-venues/:id`

Partial update for any venue fields above.

**200** — `{ "eventVenue": EventVenue }`

**Errors:** `400` invalid id/validation, `404` not found, `409` duplicate `eventNum`.

#### `DELETE /api/event-venues/:id`

Delete a venue.

**200** — `{ "eventVenue": EventVenue, "deleted": true }`

**Errors:** `400` invalid id, `404` not found.

---

### Booking endpoints

All `/api/bookings` routes require **Bearer auth**.

- **Staff roles** (`admin`, `cashier`, `frontdesk`, `housekeeping`) can access all bookings.
- **Guests** can only access their own bookings (`userId === req.user.id`).

**Booking object**

```json
{
  "id": "<ObjectId>",
  "type": "room",
  "userId": "<ObjectId>",
  "customerName": "Jane Doe",
  "email": "jane@example.com",
  "contactNumber": "09123456789",
  "status": "pending",
  "roomId": "room_101",
  "checkIn": "2026-05-10",
  "checkOut": "2026-05-11",
  "eventVenueId": "",
  "eventDate": "",
  "createdAt": "<ISO date>",
  "updatedAt": "<ISO date>"
}
```

Supported `status` values: `pending`, `confirmed`, `declined`, `cancelled`, `completed`.

#### `GET /api/bookings`

List bookings visible to the authenticated user.

**200** — `{ "bookings": [Booking, ...] }`

#### `GET /api/bookings/:id`

Get one booking if accessible to the authenticated user.

**200** — `{ "booking": Booking }`

**Errors:** `400` invalid id, `403` forbidden, `404` not found.

#### `POST /api/bookings`

Create a booking.

**Body** (common required)

| Field | Required | Notes |
|-------|----------|--------|
| `type` | yes | `room` or `event` |
| `customerName` | yes | |
| `email` | yes | |

**Additional required by type**

| Type | Required fields |
|------|-----------------|
| `room` | `roomId`, `checkIn`, `checkOut` |
| `event` | `eventVenueId`, `eventDate`, `eventTitle` |

**201** — `{ "booking": Booking }`

Notes:
- Non-staff users are forced to `status: "pending"` on create.
- Optional booking metadata fields (payment, IDs, requests, etc.) are accepted and stored if provided.

**Errors:** `400` validation.

#### `PATCH /api/bookings/:id`

Update a booking if accessible.

Rules:
- `type` cannot be changed after creation.
- `status` must be valid.
- Guests may only change `status` to `cancelled`.

**200** — `{ "booking": Booking }`

**Errors:** `400` validation, `403` forbidden, `404` not found.

#### `DELETE /api/bookings/:id`

Delete a booking if accessible.

**200** — `{ "booking": Booking, "deleted": true }`

**Errors:** `400` invalid id, `403` forbidden, `404` not found.

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
| `GET` | `/api/rooms` | No |
| `GET` | `/api/rooms/:id` | No |
| `POST` | `/api/rooms` | Bearer + admin |
| `PATCH` | `/api/rooms/:id` | Bearer + admin |
| `DELETE` | `/api/rooms/:id` | Bearer + admin |
| `GET` | `/api/event-venues` | Bearer + admin |
| `GET` | `/api/event-venues/:id` | Bearer + admin |
| `POST` | `/api/event-venues` | Bearer + admin |
| `PATCH` | `/api/event-venues/:id` | Bearer + admin |
| `DELETE` | `/api/event-venues/:id` | Bearer + admin |
| `GET` | `/api/bookings` | Bearer |
| `GET` | `/api/bookings/:id` | Bearer |
| `POST` | `/api/bookings` | Bearer |
| `PATCH` | `/api/bookings/:id` | Bearer |
| `DELETE` | `/api/bookings/:id` | Bearer |

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
