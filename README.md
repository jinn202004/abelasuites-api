# Abela / Joanah API

REST API for the Abela project: **Express**, **MongoDB** (Mongoose), **JWT** auth, **CORS** enabled for all origins by default.

| | |
|--|--|
| **Base URL** | `http://localhost:<PORT>` (default port **5000**) |
| **API prefix** | All routes below are under **`/api`** |

---

## Contents

- [Setup](#setup)
- [Project layout](#project-layout)
- [Middleware](#middleware)
- [Conventions](#conventions)
- [JWT](#jwt)
- [Endpoints](#endpoints)
- [Auth: logout](#post-apiauthlogout)
- [Staff management](#staff-management-admin-only)
- [Room endpoints](#room-endpoints)
- [Event venue endpoints](#event-venue-endpoints)
- [Booking endpoints](#booking-endpoints)
- [Frontdesk booking approval](#frontdesk-booking-approval)
- [Housekeeping (cleaning tasks)](#housekeeping-cleaning-tasks)
- [Quick reference](#quick-reference)

---

## Setup

1. **Requirements:** Node.js **18+**, a running MongoDB instance (local or [Atlas](https://www.mongodb.com/cloud/atlas)).

2. **Install**

   From the backend package folder:

   ```bash
   cd be/abela-be
   npm install
   ```

3. **Environment**

   Copy `.env.example` to `.env` in the same folder (`be/abela-be`):

   | Variable | Required | Description |
   |----------|----------|-------------|
   | `MONGODB_URI` | yes | MongoDB connection string (e.g. `mongodb://127.0.0.1:27017/joanah`) |
   | `JWT_SECRET` | yes for login | Long random string used to sign and verify JWTs |
   | `PORT` | no | HTTP port (default **5000**) |
   | `JWT_EXPIRES_IN` | no | Token lifetime (default **7d**). Examples: `24h`, `7d`, `3600` (seconds) |

   On success, the server logs a line when MongoDB connects.

4. **Database**

   - Start MongoDB locally, or use Atlas and paste the SRV URI into `MONGODB_URI`.
   - Collections (`users`, `staff`, `rooms`, `bookings`, `housekeepingtasks`, etc.) are created automatically when first used.

5. **Run**

   ```bash
   npm run dev    # Node.js --watch: restarts on file changes
   npm start      # Single run (no watch)
   ```

6. **Legacy bookings without a Guest link (optional)**  
   If you upgraded from a version where `bookings.guestId` stored a **string** (ID number) instead of a `Guest` document id, run once:

   ```bash
   npm run migrate-booking-guests
   ```

**Legacy data:** If older user documents included a `username` field, remove it in MongoDB or migrate; users are keyed by **`email`** only.

---

## Project layout

```
be/abela-be/
├── .env.example
├── package.json
├── README.md
└── src/
    ├── server.js           # Entry: connect DB, listen
    ├── app.js              # Express app (middleware + /api routes)
    ├── config/
    │   ├── index.js        # env (PORT, MONGODB_URI, JWT_*)
    │   └── database.js     # mongoose.connect
    ├── controllers/        # auth, health, user, room, staff, bookingApproval, housekeeping, …
    ├── middleware/         # auth, authMiddleware, adminMiddleware, roleMiddleware, notFound, errorHandler
    ├── models/             # User, Guest, Staff, Room, Booking, …
    ├── routes/             # mounted under /api
    ├── services/           # business logic (e.g. guest, booking, bookingApproval, housekeeping)
    └── utils/              # passwordValidation, asyncHandler
```

---

## Middleware

| Export | File | Role |
|--------|------|------|
| `authenticate` | `middleware/auth.js` | Verifies `Authorization: Bearer <JWT>`, checks revocation list, sets `req.user` |
| `authMiddleware` | `middleware/authMiddleware.js` | Same behavior as `authenticate` (alias for route modules) |
| `requireAdmin` | `middleware/requireAdmin.js` | After auth: **403** unless `req.user.role === "admin"` |
| `adminMiddleware` | `middleware/adminMiddleware.js` | Same as `requireAdmin` (alias) |
| `requireFrontdeskOrAdmin` | `middleware/roleMiddleware.js` | After auth: **403** unless role is `frontdesk` or `admin` |
| `requireHousekeepingOrAdmin` | `middleware/roleMiddleware.js` | After auth: **403** unless role is `housekeeping` or `admin` |

**Staff routes** use `authMiddleware` then `adminMiddleware` so only admins can manage the `staff` collection.

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

### `POST /api/auth/logout`

Ends the current session by **blacklisting the JWT** until its natural expiry (stored in `RevokedToken`). **Requires authentication:** send the same bearer token you are revoking.

**Headers:** `Authorization: Bearer <access_token>`

**200** — `{ "message": "Logged out successfully", "revoked": true }`

**Errors:** `400` (no bearer token), `401` (invalid/expired/revoked token), `403` (token subject mismatch).

---

### Staff management (admin only)

All `/api/staff` routes require **`Authorization: Bearer <token>`** and **`role: "admin"`** in that token.

**Staff object**

```json
{
  "id": "<ObjectId>",
  "name": "Jane Doe",
  "email": "jane@example.com",
  "role": "Front Desk",
  "department": "Front Office",
  "contact": "09123456789",
  "status": "Active",
  "createdAt": "<ISO date>",
  "updatedAt": "<ISO date>"
}
```

Allowed `role` values: `Admin`, `Front Desk`, `Housekeeping`, `Cashier`.  
Allowed `status` values: `Active`, `On Leave`, `Inactive`.

#### `GET /api/staff`

List all staff (newest first).

**200** — `{ "staff": [Staff, ...] }`

**Errors:** `401`, `403`.

#### `POST /api/staff`

Create a staff record.

**Body**

| Field | Required | Notes |
|-------|----------|--------|
| `name` | yes | Non-empty string |
| `email` | yes | Unique |
| `role` | yes | One of the allowed values |
| `department` | yes | e.g. `Operations` |
| `contact` | no | Phone / extension (stored trimmed) |
| `status` | no | Defaults to `Active` |

**201** — `{ "staff": Staff }`

**Errors:** `400` validation, `401`, `403`, `409` duplicate email.

#### `PUT /api/staff/:id`

Update a staff member (partial body supported: send only fields to change).

**200** — `{ "staff": Staff }`

**Errors:** `400` invalid id / validation, `401`, `403`, `404`, `409` duplicate email.

#### `DELETE /api/staff/:id`

Delete a staff record.

**200** — `{ "staff": Staff, "deleted": true }`

**Errors:** `400` invalid id, `401`, `403`, `404`.

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

#### Bookings ↔ guests (MongoDB)

- Collection **`guests`** holds a **guest profile** (name, email, phone, valid ID fields, optional link to `users` via `userId`).
- Each **booking** document has **`guestId`** → `ObjectId` reference **`Guest`** (many bookings can point to the same guest when they share an account or email).
- On **`POST /api/bookings`**, the API **upserts** a `Guest` from the request body and sets **`booking.guestId`**. Denormalized `customerName` / `email` on the booking remain for compatibility and search.
- **`GET /api/bookings`** and **`GET /api/bookings/:id`** **populate** `guestId` and return a nested **`guest`** object (staff see ID photo fields where applicable).

**Booking object (abbrev.)**

```json
{
  "id": "<ObjectId>",
  "type": "room",
  "userId": "<ObjectId>",
  "guestId": "<ObjectId>",
  "guest": {
    "id": "<ObjectId>",
    "userId": "<ObjectId or null>",
    "displayName": "Jane Doe",
    "email": "jane@example.com",
    "phone": "09123456789",
    "address": "",
    "validIdNumber": "P1234567",
    "validIdPhotoName": "",
    "validIdPhotoData": ""
  },
  "customerName": "Jane Doe",
  "email": "jane@example.com",
  "contactNumber": "09123456789",
  "status": "pending",
  "roomId": "room_101",
  "checkIn": "2026-05-10",
  "checkOut": "2026-05-11",
  "eventVenueId": "",
  "eventDate": "",
  "approvedBy": null,
  "approvedAt": null,
  "createdAt": "<ISO date>",
  "updatedAt": "<ISO date>"
}
```

`validIdPhotoData` may be omitted in list responses for non-staff to reduce payload size.

Supported `status` values: `pending`, `approved`, `rejected`, `confirmed`, `declined`, `cancelled`, `completed`.

- New bookings default to **`pending`** until front desk or an admin approves or rejects them via the [approval API](#frontdesk-booking-approval).
- **`approved`** / **`rejected`** set `approvedBy` (MongoDB user id of the staff member) and **`approvedAt`** (ISO timestamp). Rejections may also populate `declineReason`.
- Legacy documents may still use **`confirmed`** / **`declined`**; the history endpoint treats `declined` like **`rejected`** for listing.

#### `GET /api/bookings`

List bookings visible to the authenticated user. Each item includes **`guest`** (populated from `guestId`) when available.

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

### Frontdesk booking approval

Front desk and **admin** users can review **`pending`** bookings and move them to **`approved`** or **`rejected`**. Flow: `bookingApproval.routes.js` → `bookingApproval.controller.js` (`getPendingBookingsWithGuest`, `getBookingHistoryWithGuest`, `approveBooking`, `rejectBooking`) → `bookingApproval.service.js` (populate **`Guest`** via `guestId`, business rules).

**Auth:** `Authorization: Bearer <token>` with JWT role **`frontdesk`** or **`admin`**.

**Full list with guest info:** use **`GET /api/bookings`** with a staff token (same data shape as above; includes **`guest`**).

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/bookings/pending` | Pending bookings, **`guest`** populated (includes ID fields for verification). |
| `GET` | `/api/bookings/history` | Approved / rejected / legacy `declined`, with **`guest`**. |
| `PUT` | `/api/bookings/:id/approve` | Approve a **pending** booking; sets `status`, `approvedBy`, `approvedAt`. |
| `PUT` | `/api/bookings/:id/reject` | Reject a **pending** booking; optional JSON body `{ "reason": "…" }` (stored in `declineReason`). |

**Rules**

- Target booking must exist and be **`pending`**. Already processed bookings return **409** with `Only pending bookings can be approved or rejected`.
- Invalid `:id` returns **400**; missing booking returns **404**.

**Example — list pending (curl)**

```bash
curl -s http://localhost:5000/api/bookings/pending \
  -H "Authorization: Bearer <frontdesk_or_admin_token>"
```

**200**

```json
{
  "bookings": [
    {
      "id": "…",
      "type": "room",
      "status": "pending",
      "customerName": "Jane Doe",
      "email": "jane@example.com",
      "guest": {
        "id": "…",
        "displayName": "Jane Doe",
        "email": "jane@example.com",
        "phone": "09123456789",
        "validIdNumber": "P1234567"
      },
      "checkIn": "2026-05-10",
      "checkOut": "2026-05-11"
    }
  ]
}
```

**Example — approve**

```http
PUT /api/bookings/6610a1b2c3d4e5f678901234/approve HTTP/1.1
Host: localhost:5000
Authorization: Bearer <token>
Content-Type: application/json

{}
```

**200** — `{ "booking": { …, "status": "approved", "approvedBy": "<userId>", "approvedAt": "<ISO>" } }`

**Example — reject with reason**

```http
PUT /api/bookings/6610a1b2c3d4e5f678901234/reject HTTP/1.1
Host: localhost:5000
Authorization: Bearer <token>
Content-Type: application/json

{"reason": "No availability for those dates"}
```

**Testing in Postman**

1. **Login** with `POST /api/auth/login` using a user whose `role` is `frontdesk` or `admin`; copy `token`.
2. Create a **guest** booking with another account (`POST /api/bookings`) so a row stays `pending`.
3. Call **`GET /api/bookings/pending`** with the staff Bearer token.
4. **`PUT`** `/api/bookings/<id>/approve` or `/reject` and verify **`GET /api/bookings/history`** shows the result.

The **Front desk dashboard** (`/frontdesk-dashboard`) includes a **Pending guest bookings** table (approve / reject) that consumes these APIs when the user is signed in with a valid JWT.

**After approval:** `bookingApproval.service.js` calls `housekeeping.service.triggerAfterBookingApproved()` so that:

1. The related **room** (`bookings.roomId` → `rooms._id`) or **event venue** (`bookings.eventVenueId` → `eventvenues._id`) is set to operational status **`needs_cleaning`**.
2. A **`HousekeepingTask`** document is created (`type: "cleaning_request"`, `status: "pending"`, unique per `bookingId`) so housekeeping staff can track work.

Relationships: **`Booking`** references **`Guest`** via `guestId`, and points to catalog rows via **`roomId`** (room bookings) or **`eventVenueId`** (event bookings).

---

### Housekeeping (cleaning tasks)

**Auth:** `Authorization: Bearer <token>` with JWT role **`housekeeping`** or **`admin`**.

Implementation: `housekeeping.routes.js` → `housekeeping.controller.js` → `housekeeping.service.js`. Tasks are stored in **`housekeepingtasks`** (see `models/HousekeepingTask.js`).

#### Workflow

1. Guest submits booking → `Booking.status = pending`.
2. Front desk **`PUT /api/bookings/:id/approve`** → `Booking.status = approved`, `approvedBy`, `approvedAt`; guest notification sent; **housekeeping trigger** runs (see above).
3. Housekeeping opens **`GET /api/housekeeping/tasks`** — sees tasks with asset status **`needs_cleaning`**.
4. **`PUT /api/housekeeping/:id/status`** with `{ "status": "in_progress" }` → task **`in_progress`**, room/venue → **`cleaning_in_progress`**.
5. **`PUT`** with `{ "status": "completed" }` → task **`completed`**, room/venue → **`ready`**.

**Room / venue operational status** (fields on `rooms` and `eventvenues`): `available` | `occupied` | `needs_cleaning` | `cleaning_in_progress` | `ready` (default `available` for new catalog rows).

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/housekeeping/tasks` | List cleaning tasks. Query: `includeCompleted=1` to include completed rows (dashboard stats). |
| `PUT` | `/api/housekeeping/:id/status` | Advance task: body `{ "status": "in_progress" }` (from **pending**) or `{ "status": "completed" }` (from **in_progress**). |

**200 — list sample**

```json
{
  "tasks": [
    {
      "id": "…",
      "type": "cleaning_request",
      "status": "pending",
      "targetType": "room",
      "createdAt": "2026-04-16T12:00:00.000Z",
      "booking": {
        "id": "…",
        "customerName": "Jane Doe",
        "email": "jane@example.com",
        "bookingType": "room",
        "bookingStatus": "approved"
      },
      "room": {
        "id": "…",
        "title": "Single Suites",
        "roomNumber": "RM01",
        "package": "Single Suites",
        "status": "needs_cleaning"
      },
      "eventVenue": null
    }
  ]
}
```

**200 — update sample**

```http
PUT /api/housekeeping/6610a1b2c3d4e5f678901234/status HTTP/1.1
Authorization: Bearer <housekeeping_or_admin_token>
Content-Type: application/json

{"status":"in_progress"}
```

```json
{
  "task": {
    "id": "6610a1b2c3d4e5f678901234",
    "status": "in_progress",
    "room": { "status": "cleaning_in_progress", "…": "…" }
  }
}
```

The **housekeeping dashboard** (`/dashboard` in the housekeeping app) loads these tasks and exposes **Start cleaning** / **Mark ready** actions.

---

## Quick reference

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/api/health` | No |
| `POST` | `/api/auth/register` | No |
| `POST` | `/api/auth/login` | No |
| `POST` | `/api/auth/logout` | Bearer |
| `GET` | `/api/staff` | Bearer + admin |
| `POST` | `/api/staff` | Bearer + admin |
| `PUT` | `/api/staff/:id` | Bearer + admin |
| `DELETE` | `/api/staff/:id` | Bearer + admin |
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
| `GET` | `/api/bookings` | Bearer (includes **`guest`**) |
| `GET` | `/api/bookings/:id` | Bearer |
| `POST` | `/api/bookings` | Bearer |
| `PATCH` | `/api/bookings/:id` | Bearer |
| `DELETE` | `/api/bookings/:id` | Bearer |
| `GET` | `/api/bookings/pending` | Bearer + frontdesk or admin |
| `GET` | `/api/bookings/history` | Bearer + frontdesk or admin |
| `PUT` | `/api/bookings/:id/approve` | Bearer + frontdesk or admin |
| `PUT` | `/api/bookings/:id/reject` | Bearer + frontdesk or admin |
| `GET` | `/api/housekeeping/tasks` | Bearer + housekeeping or admin |
| `PUT` | `/api/housekeeping/:id/status` | Bearer + housekeeping or admin |

---

## Example

**Login**

```http
POST /api/auth/login HTTP/1.1
Host: localhost:5000
Content-Type: application/json

{"email":"user@example.com","password":"Yourpass1!"}
```

**Authenticated request**

```http
GET /api/users/me HTTP/1.1
Host: localhost:5000
Authorization: Bearer <token>
```

**Logout (invalidate current JWT)**

```http
POST /api/auth/logout HTTP/1.1
Host: localhost:5000
Authorization: Bearer <token>
```

**Create staff (admin token)**

```bash
curl -s -X POST http://localhost:5000/api/staff \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d "{\"name\":\"Jane Doe\",\"email\":\"jane@hotel.com\",\"role\":\"Front Desk\",\"department\":\"Front Office\",\"contact\":\"09123456789\",\"status\":\"Active\"}"
```

**List staff**

```bash
curl -s http://localhost:5000/api/staff -H "Authorization: Bearer <admin_token>"
```

---

## Other responses

| Status | Meaning |
|--------|---------|
| **404** | Unknown path: `{ "error": "Not found" }` |
| **500** | Unhandled error: `{ "error": "Internal server error" }` or a specific message |

Use a strong **`JWT_SECRET`** in production and keep `.env` out of version control.
