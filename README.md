# Abela / Joanah APIimage.png

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
- [Guest billing system](#guest-billing-system)
- [Guest reviews & landing testimonials](#guest-reviews--landing-testimonials)
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
   | `AUTO_APPROVE_REVIEWS` | no | If `true` or `1`, new guest reviews are approved immediately for `/api/testimonials` |

   On success, the server logs a line when MongoDB connects.

4. **Database**

   - Start MongoDB locally, or use Atlas and paste the SRV URI into `MONGODB_URI`.
   - Collections (`users`, `guests`, `rooms`, `bookings`, `billings`, `reviews`, `housekeepingtasks`, etc.) are created automatically when first used. **Staff accounts are rows in `users`** with roles `admin`, `cashier`, `frontdesk`, or `housekeeping` (there is no separate `staff` collection).

5. **Run**

   ```bash
   npm run dev    # Node.js --watch: restarts on file changes
   npm start      # Single run (no watch)
   ```

   **Check MongoDB only** (uses `MONGODB_URI` from `be/abela-be/.env`):

   ```bash
   npm run db:ping
   ```

6. **Legacy bookings without a Guest link (optional)**  
   If you upgraded from a version where `bookings.guestId` stored a **string** (ID number) instead of a `Guest` document id, run once:

   ```bash
   npm run migrate-booking-guests
   ```

7. **Billing rows for existing bookings (optional)**  
   After deploying the guest billing feature, create `Billing` documents for bookings that already existed:

   ```bash
   npm run backfill-billings
   ```

**Legacy `username` index:** Some MongoDB databases still have a **unique index on `username`**. Guest signup sets `username` to the same value as **`email`** so new users do not hit `E11000` on `username: null`. Admin/staff seed scripts do the same. Identity for the app remains **`email`** + password; you do not type a separate username on the sign-up form.

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
    ├── controllers/        # auth, health, user, room, staff, booking, billing, guest, bookingApproval, housekeeping, …
    ├── middleware/         # auth, authMiddleware, adminMiddleware, roleMiddleware, notFound, errorHandler
    ├── models/             # User, Guest, Room, Booking, Billing, …
    ├── routes/             # mounted under /api
    ├── services/           # business logic (e.g. guest, booking, billing, bookingApproval, housekeeping)
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
| `requireFrontdeskOrAdmin` | `middleware/roleMiddleware.js` | After auth: **403** unless role is `frontdesk` or `admin` (booking approval, review moderation, etc.) |
| `requireHousekeepingOrAdmin` | `middleware/roleMiddleware.js` | After auth: **403** unless role is `housekeeping` or `admin` (task list / status updates) |
| `requireHousekeepingFrontdeskOrAdmin` | `middleware/roleMiddleware.js` | After auth: **403** unless role is `frontdesk`, `housekeeping`, or `admin` (read-only recent cleaning queue for coordination) |
| `requireBillingStaff` | `middleware/roleMiddleware.js` | After auth: **403** unless role is `cashier`, `frontdesk`, or `admin` (**billing list** and staff read paths that reuse this guard) |
| `requireCashierOrAdmin` | `middleware/roleMiddleware.js` | After auth: **403** unless role is `cashier` or `admin` (**record payments** on `PUT /api/billing/:id/payment`) |
| `requireGuestRole` | `middleware/roleMiddleware.js` | After auth: **403** unless JWT role is exactly `guest` (e.g. `GET /api/billing/my`) |

**`/api/staff` routes** use authentication plus **`admin`** so only admins can create and manage **login accounts** for non-guest roles. Those accounts are stored in the **`users`** collection (not a separate staff table).

### RBAC summary (by area)

| Area | Roles allowed |
|------|----------------|
| Booking approve / reject (`PUT /api/bookings/:id/approve`, `…/reject`) | `frontdesk`, `admin` |
| Housekeeping task status (`PUT /api/housekeeping/:id/status`) | `housekeeping`, `admin` |
| Room housekeeping status (`PATCH /api/rooms/:id/housekeeping-status`) | `frontdesk`, `admin` |
| Billing list (`GET /api/billing`) | `cashier`, `frontdesk`, `admin` |
| Billing detail (`GET /api/billing/:id`) | Same as list, **or** owning `guest` (via booking / guest profile) |
| Record payment (`PUT /api/billing/:id/payment`) | `cashier`, `admin` only (front desk is read-only for payments) |
| Own billing (`GET /api/billing/my`) | `guest` only |

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

### Roles (single `users` table)

All accounts—guests and staff—are **`User`** documents. The `role` field is one of:

| Role | Description |
|------|-------------|
| `admin` | Full system access; user/staff management; all billing and housekeeping overrides. |
| `frontdesk` | Manage and approve/reject bookings; view guests, billing, and housekeeping coordination; **no** payment writes on billing API. |
| `cashier` | View all billing; **record payments** (`amountPaid`); balance and `paymentStatus` are derived. **Cannot** approve bookings or change housekeeping task status. |
| `housekeeping` | View and update cleaning tasks; room/venue cleaning status workflow. |
| `guest` | Create bookings; view own bookings and own billing (`/api/billing/my` and owned `GET /api/billing/:id`). |

**`users` collection (main fields):** MongoDB `_id`, `email`, `passwordHash` (bcrypt; API uses the term **password** on register / staff create), `role`, optional `name`, `firstName`, `lastName`, `phone`, `username` (often equal to `email` for legacy indexes), and for staff rows optional `department`, `staffStatus`. Timestamps: `createdAt`, `updatedAt`.

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

These endpoints manage **`User`** rows with non-guest roles (same collection as guest accounts). The API response shape is still called **staff** for the admin UI.

**Staff object (API)**

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

Allowed `role` values (request / display): `Admin`, `Front Desk`, `Housekeeping`, `Cashier` (stored on the user as `admin`, `frontdesk`, `housekeeping`, `cashier`).  
Allowed `status` values: `Active`, `On Leave`, `Inactive` (stored as `staffStatus` on the user).

#### `GET /api/staff`

List all staff (newest first).

**200** — `{ "staff": [Staff, ...] }`

**Errors:** `401`, `403`.

#### `POST /api/staff`

Create a **user account** for a staff role (hashed password stored on `User`).

**Body**

| Field | Required | Notes |
|-------|----------|--------|
| `name` | yes | Non-empty string (also used as display name) |
| `email` | yes | Unique |
| `password` | yes | [Password rules](#conventions); required so the person can sign in |
| `role` | yes | One of the allowed display values |
| `department` | yes | e.g. `Operations` |
| `contact` | no | Phone / extension (stored on `User.phone`, trimmed) |
| `status` | no | Defaults to `Active` |

**201** — `{ "staff": Staff }`

**Errors:** `400` validation, `401`, `403`, `409` duplicate email.

#### `PUT /api/staff/:id`

Update a staff user (partial body supported: send only fields to change). Optional **`password`** sets a new login password (must meet [password rules](#conventions)).

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

#### `PATCH /api/rooms/:id/housekeeping-status`

Partial update: **`status` only**, restricted to **`needs_cleaning`** and **`ready`** (`ready` is guest-ready and shown as “Available” in the front desk housekeeping UI).

**Auth:** Bearer + **front desk** or **admin** (not housekeeping-only).

**Body:** `{ "status": "needs_cleaning" | "ready" }`

**200** — `{ "room": Room }`

**Errors:** `400` invalid id or status, `404` not found.

#### `DELETE /api/rooms/:id`

Delete a room.

**200** — `{ "room": Room, "deleted": true }`

**Errors:** `400` invalid id, `404` not found.

---

### Event venue endpoints

**Bearer auth** is required for all `/api/event-venues` routes. **`GET /api/event-venues`** and **`GET /api/event-venues/:id`** allow **front desk**, **housekeeping**, or **admin** (read-only catalog for staff dashboards). **`POST`**, **`PATCH`**, and **`DELETE`** require **admin**.

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

### Notifications (staff + guest)

**Flow:** `notification.routes.js` -> `notification.controller.js` -> `notification.service.js` -> MongoDB notifications + booking lookup.

Booking-approval files remain in `bookingApproval.routes.js` -> `bookingApproval.controller.js` -> `bookingApproval.service.js`.

#### Notification workflow

1. Guest creates a booking (`POST /api/bookings`) -> frontdesk notification created with type **`booking_review`** and linked `bookingId`.
2. Frontdesk/admin approves (`PUT /api/bookings/:id/approve`) -> booking status moves to `approved`, guest notification created with type **`booking_approved`**.
3. Frontdesk/admin rejects (`PUT /api/bookings/:id/reject`) -> booking status moves to `rejected`, guest rejection notification is also emitted.
4. Frontend bell dropdowns poll and refresh, each row carries `bookingId` for direct action or navigation.

#### Notification schema (API shape)

- `id`
- `userId` (receiver)
- `bookingId` (linked booking)
- `type` (`booking_review`, `booking_approved`, plus existing legacy-compatible values)
- `message`
- `isRead` / `read`
- `createdAt`

#### Notification API

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/notifications` | Get notifications for the signed-in user (guest/frontdesk/admin). |
| `PUT` | `/api/notifications/:id/read` | Mark one notification as read. |
| `PUT` | `/api/notifications/read-all` | Mark all notifications as read for current user. |

#### Guest notification endpoints (`/api/users/me/notifications`)

These are role-agnostic user inbox endpoints exposed from `user.routes.js` + `guestNotification.controller.js`.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/users/me/notifications` | Get current user notification list (guest app inbox shape). |
| `PATCH` | `/api/users/me/notifications/:notificationId/read` | Mark one notification as read. |
| `PATCH` | `/api/users/me/notifications/read-all` | Mark all current user notifications as read. |

#### Staff/frontdesk notification endpoints (`/api/staff-notifications`)

`requireFrontdeskOrAdmin` guard.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/staff-notifications` | Frontdesk/admin notification list (booking-review and related staff actions). |
| `PATCH` | `/api/staff-notifications/read-all` | Mark all frontdesk/admin notifications as read. |

**Frontend behavior**

- Frontdesk: clicking a booking-review notification opens the booking review modal (guest/booking/room-event details + approve/reject actions).
- Guest: clicking a booking notification routes to `/my-bookings/:bookingId` (booking details/status/payment context).

---

### Frontdesk unified module

**Flow:** `frontdesk.routes.js` -> `frontdesk.controller.js` -> `frontdesk.service.js` -> MongoDB.

**Goal:** one API call that returns integrated booking context for frontdesk/admin (guest + booking + billing + room/event + housekeeping).

#### Endpoint

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/api/frontdesk/summary` | Bearer + frontdesk or admin |
| `GET` | `/api/frontdesk/bookings/:id` | Bearer + frontdesk or admin |

**`GET /api/frontdesk/summary`** returns `{ reservationsToday, checkOutsToday, totalRevenue, outstandingBalances }` computed from the same MongoDB queries as staff booking and billing lists (ledger totals plus bookings without a billing row yet).

#### Data relationships

- **Booking** is the base row (`bookings._id`).
- **Guest** comes from `booking.guestId` (fallback: booking contact fields).
- **Billing** comes from `billings.bookingId = booking._id`.
- **Room/Event** is resolved by `booking.roomId` or `booking.eventVenueId`.
- **HousekeepingTask** comes from `housekeepingtasks.bookingId = booking._id` (latest row).

#### Example response

```json
{
  "guest": {
    "id": "6622...",
    "name": "Jane Doe",
    "email": "jane@example.com",
    "contact": "09123456789"
  },
  "booking": {
    "id": "6610...",
    "type": "room",
    "status": "pending",
    "roomOrEvent": "Single Suites",
    "roomId": "65ff...",
    "eventVenueId": ""
  },
  "billing": {
    "id": "6633...",
    "totalAmount": 2205,
    "amountPaid": 661.5,
    "balance": 1543.5,
    "paymentStatus": "partial"
  },
  "room": {
    "targetType": "room",
    "id": "65ff...",
    "name": "Single Suites",
    "status": "needs_cleaning",
    "roomNumber": "RM01"
  },
  "housekeeping": {
    "targetType": "room",
    "roomOrEventStatus": "needs_cleaning",
    "taskStatus": "pending",
    "taskId": "6644..."
  }
}
```

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

**Room / venue operational status** (fields on `rooms` and `eventvenues`): `available` | `occupied` | `needs_cleaning` | `cleaning_in_progress` | `ready` (default `available` for new catalog rows). Compound indexes **`{ status: 1, updatedAt: -1 }`** on `rooms` and `eventvenues` support the recent-cleaning query.

**Booking approval:** `bookingApproval.service` calls `triggerAfterBookingApproved`, which sets the linked room or venue to **`needs_cleaning`** and bumps **`updatedAt`**, creates a **`HousekeepingTask`** (unique **`bookingId`**, so duplicate tasks are avoided), and notifies housekeeping.

#### Recent cleaning queue (front desk UI)

**Feature:** Read-only list of rooms and venues with status **`needs_cleaning`**, merged and sorted by **`updatedAt`** (newest first). Used by the **front desk dashboard** only—not on the front desk Housekeeping page or the housekeeping staff app dashboard.

**Auth:** Bearer with role **`frontdesk`**, **`housekeeping`**, or **`admin`** (`requireHousekeepingFrontdeskOrAdmin`).

**Service:** `housekeeping.service.getRecentCleaningTasks()`.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/housekeeping/recent-cleaning` | JSON `{ "recentCleaning": [ … ] }`. Optional query `limit` (1–50). |
| `GET` | `/api/housekeeping/tasks` | List cleaning tasks. Query: `includeCompleted=1` to include completed rows (dashboard stats). |
| `PUT` | `/api/housekeeping/:id/status` | Advance task: body `{ "status": "in_progress" }` (from **pending**) or `{ "status": "completed" }` (from **in_progress**). **Housekeeping or admin only.** |
| `GET` | `/api/housekeeping/notifications` | Housekeeping/admin notification list for cleaning workflow updates. |
| `PATCH` | `/api/housekeeping/notifications/read-all` | Mark all housekeeping notifications as read. |
| `POST` | `/api/housekeeping/reconcile-missing` | Backfill missing housekeeping tasks from approved bookings (admin/housekeeping maintenance endpoint). |

**200 — recent-cleaning sample**

```json
{
  "recentCleaning": [
    {
      "targetType": "room",
      "id": "6644ab12cd34ef5678901234",
      "roomId": 101,
      "roomName": "Single Suites — Room 101",
      "status": "needs_cleaning",
      "updatedAt": "2026-04-26T08:00:00.000Z"
    }
  ]
}
```

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

The **housekeeping staff dashboard** loads **`GET /api/housekeeping/tasks`** and exposes **Start cleaning** / **Mark ready** actions (**`PUT /api/housekeeping/:id/status`** remains housekeeping/admin only). The **front desk dashboard** loads **`GET /api/housekeeping/recent-cleaning`** and **`GET /api/housekeeping/tasks`** (read-only for front desk) for a combined cleaning queue.

---

### Guest billing system

**Feature:** Each booking can have one **Billing** ledger row. **Balance** is `max(0, totalAmount - amountPaid)` in API responses. **`paymentStatus`** (`paid` \| `partial` \| `unpaid`) is kept consistent on save by the Billing model from `totalAmount` and `amountPaid`. **Cashier, front desk, and admin** can list and open any ledger; **cashier and admin** record payments via **`PUT /api/billing/:id/payment`**; **guest** accounts see only their own rows (by `Booking.userId` or linked `Guest.userId`).

**Flow:** `billing.routes.js` → `billing.controller.js` → `billing.service.js` → MongoDB (`billings`, `bookings`, `guests`). `guest.routes.js` / `guest.controller.js` expose **`GET /api/guests/me`** for the logged-in user’s **Guest** profile (separate from `/api/users/me`).

#### Database schema (MongoDB)

| Collection | Purpose |
|------------|---------|
| **`guests`** | Guest profile: `displayName`, `email`, `phone`, optional `userId` → registered **User**. API billing responses map **`name`** ← `displayName`, **`contactNumber`** ← `phone`. |
| **`bookings`** | Existing model: `guestId` → Guest, `userId` → User who created the booking, monetary fields (`totalAmount`, `venuePrice`, `paymentAmount`, …). |
| **`billings`** | One document per booking: `guestId`, `bookingId` (unique), `totalAmount`, `amountPaid`, `paymentStatus`, timestamps (`createdAt`, `updatedAt`). |

**Relationships**

- **Guest** → has many **Bookings** (`Booking.guestId`).
- **Booking** → belongs to **Guest** and **User** (`userId`).
- **Billing** → belongs to **Guest** and **Booking** (`guestId`, `bookingId`).

**Derived values**

- `balance = max(0, totalAmount - amountPaid)` (returned in JSON; not stored separately).
- `paymentStatus`: **`paid`** if balance is zero; **`partial`** if `amountPaid > 0` but not full; **`unpaid`** if no payment.

On **new bookings**, the API creates a **Billing** row when the booking has a valid `guestId`. **`PATCH /api/bookings/:id`** syncs totals/paid from the booking into **Billing** when payment fields change. **`PUT /api/billing/:id/payment`** (staff) is the canonical way to record payments and also updates **`bookings.paymentAmount`**. Deleting a booking removes its **Billing** row.

#### Auth

| Role | Billing access |
|------|----------------|
| `cashier`, `frontdesk`, `admin` | `GET /api/billing`, `GET /api/billing/:id` for any record |
| `cashier`, `admin` | `PUT /api/billing/:id/payment` (record `amountPaid`; balance and status updated automatically) |
| `frontdesk` | **No** `PUT /api/billing/:id/payment` (**403**); use cashier or admin for payment entry |
| `guest` | `GET /api/billing/my`, `GET /api/billing/:id` only when the billing’s guest or booking is theirs |
| `housekeeping` | No general billing list/detail (**403**) |

All billing routes require **`Authorization: Bearer <token>`**.

#### Guest profile

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/guests/me` | Bearer | Current user’s **Guest** document (`name` / `email` / `contactNumber` shape plus ids). **`guest` may be `null`** until a profile exists. |

#### Billing API

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/billing` | Bearer + **cashier, frontdesk, or admin** | All billing records, newest first. **200:** `{ "records": [ … ] }` |
| `GET` | `/api/billing/my` | Bearer + **guest** role | Billing rows for the current guest only. **200:** `{ "records": [ … ] }` |
| `GET` | `/api/billing/:id` | Bearer | One record if **cashier / frontdesk / admin** **or** owner guest. |
| `PUT` | `/api/billing/:id/payment` | Bearer + **cashier or admin** | Body: `{ "amountPaid": <number> }` (non-negative, cannot exceed `totalAmount`). **200:** same shape as a single list item. |

**Single record shape (list items and `GET /api/billing/:id`)**

```json
{
  "id": "<Billing ObjectId>",
  "guest": {
    "name": "John Doe",
    "email": "john@email.com",
    "contactNumber": "09171234567"
  },
  "booking": {
    "id": "<Booking ObjectId>",
    "type": "room",
    "room": "Deluxe King (101)",
    "status": "approved",
    "checkIn": "2026-05-10",
    "checkOut": "2026-05-11",
    "eventDate": ""
  },
  "billing": {
    "totalAmount": 5000,
    "amountPaid": 3000,
    "balance": 2000,
    "paymentStatus": "partial",
    "createdAt": "<ISO date>",
    "updatedAt": "<ISO date>"
  }
}
```

For **event** bookings, `booking.room` is a label built from **venue / event title** (the field name stays `room` for a stable client shape).

**Errors:** `400` invalid id or invalid `amountPaid`; `401` missing/invalid token; `403` wrong role or not your billing; `404` unknown billing id or missing booking for that billing.

---

### Guest reviews & landing testimonials

**Feature:** Guests submit a **review** after a booking is **`completed`**. Reviews are stored with optional moderation (`isApproved`). The **public** landing page loads **`GET /api/testimonials`**, which returns only **approved** reviews as testimonial cards (guest name, rating, comment).

**Flow:** `review.routes.js` / `testimonial.routes.js` → controllers → `review.service.js` / `testimonial.service.js` → MongoDB collection **`reviews`**.

#### Database schema (MongoDB)

| Collection | Fields (main) |
|------------|----------------|
| **`reviews`** | `guestId` → Guest (required), `bookingId` → Booking (**unique** — one review per booking), `rating` (1–5), `comment` (string, max 2000), `isApproved` (boolean, default `false`), `createdAt` / `updatedAt`. |
| **`guests`** | Existing profile; testimonial **name** uses `displayName`, with fallback to booking `customerName`. |

**Relationships**

- **Review** → belongs to **Guest** (`guestId`).
- **Review** → belongs to **Booking** (`bookingId`).

#### Auto-approval (optional)

Set in `.env`:

```env
AUTO_APPROVE_REVIEWS=true
```

When enabled, new reviews are created with **`isApproved: true`** and appear on the homepage immediately. Otherwise, authorized billing staff (**cashier**, **frontdesk**, or **admin**) can call **`PUT /api/reviews/:id/approve`**.

#### API

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/reviews` | Bearer + **guest** | Body: `{ "bookingId": "<ObjectId>", "rating": 1-5, "comment": "..." }`. Booking must be **`completed`** and owned by the user. **201:** `{ "review": { … } }`. **409** if a review already exists for that booking. |
| `GET` | `/api/reviews/me` | Bearer + **guest** | Reviews by the current guest profile (`bookingId`, `isApproved`, etc.). |
| `GET` | `/api/reviews` | Bearer + **cashier, frontdesk, or admin** | All reviews (newest first), for moderation. |
| `PUT` | `/api/reviews/:id/approve` | Bearer + **cashier, frontdesk, or admin** | Sets `isApproved: true`. |
| `GET` | `/api/testimonials` | **None** | Approved reviews only, for the marketing site. |

**Example: `GET /api/testimonials`**

```json
{
  "testimonials": [
    {
      "guestName": "John Doe",
      "rating": 5,
      "comment": "Excellent service and clean rooms!"
    }
  ]
}
```

**Validation errors:** `400` invalid ids, rating out of range, or empty comment; `403` not your booking; `404` booking not found; `409` booking not completed or duplicate review.

**Frontend:** The landing page (`TestimonialsSection`) calls **`GET /api/testimonials`** on load and periodically while the tab is visible. Guests submit from **Booking History** after checkout is marked **completed** (requires a **Guest** profile linked to the booking flow).

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
| `GET` | `/api/users/me/notifications` | Bearer |
| `PATCH` | `/api/users/me/notifications/:notificationId/read` | Bearer |
| `PATCH` | `/api/users/me/notifications/read-all` | Bearer |
| `PATCH` | `/api/users/:id` | Bearer |
| `GET` | `/api/users/:id` | No |
| `GET` | `/api/rooms` | No |
| `GET` | `/api/rooms/:id` | No |
| `POST` | `/api/rooms` | Bearer + admin |
| `PATCH` | `/api/rooms/:id` | Bearer + admin |
| `DELETE` | `/api/rooms/:id` | Bearer + admin |
| `GET` | `/api/event-venues` | Bearer + frontdesk, housekeeping, or admin |
| `GET` | `/api/event-venues/:id` | Bearer + frontdesk, housekeeping, or admin |
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
| `GET` | `/api/frontdesk/summary` | Bearer + frontdesk or admin |
| `GET` | `/api/frontdesk/bookings/:id` | Bearer + frontdesk or admin |
| `GET` | `/api/notifications` | Bearer |
| `PUT` | `/api/notifications/:id/read` | Bearer |
| `PUT` | `/api/notifications/read-all` | Bearer |
| `GET` | `/api/staff-notifications` | Bearer + frontdesk or admin |
| `PATCH` | `/api/staff-notifications/read-all` | Bearer + frontdesk or admin |
| `GET` | `/api/housekeeping/recent-cleaning` | Bearer + frontdesk, housekeeping, or admin |
| `GET` | `/api/housekeeping/tasks` | Bearer + frontdesk, housekeeping, or admin (read list; status updates still HK/admin) |
| `PUT` | `/api/housekeeping/:id/status` | Bearer + housekeeping or admin |
| `GET` | `/api/housekeeping/notifications` | Bearer + housekeeping or admin |
| `PATCH` | `/api/housekeeping/notifications/read-all` | Bearer + housekeeping or admin |
| `POST` | `/api/housekeeping/reconcile-missing` | Bearer + housekeeping or admin |
| `GET` | `/api/guests/me` | Bearer |
| `GET` | `/api/billing` | Bearer + cashier, frontdesk, or admin |
| `GET` | `/api/billing/my` | Bearer + guest |
| `GET` | `/api/billing/:id` | Bearer (owner guest or cashier/frontdesk/admin) |
| `PUT` | `/api/billing/:id/payment` | Bearer + cashier or admin |
| `GET` | `/api/testimonials` | No |
| `POST` | `/api/reviews` | Bearer + guest |
| `GET` | `/api/reviews/me` | Bearer + guest |
| `GET` | `/api/reviews` | Bearer + cashier, frontdesk, or admin |
| `PUT` | `/api/reviews/:id/approve` | Bearer + cashier, frontdesk, or admin |

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

**Create staff user (admin token)**

```bash
curl -s -X POST http://localhost:5000/api/staff \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d "{\"name\":\"Jane Doe\",\"email\":\"jane@hotel.com\",\"password\":\"Yourpass1!\",\"role\":\"Front Desk\",\"department\":\"Front Office\",\"contact\":\"09123456789\",\"status\":\"Active\"}"
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
