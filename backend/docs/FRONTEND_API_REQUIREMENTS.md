# Frontend API Requirements

Blueprint for backend integration. The passenger UI calls these endpoints through `API.get/post/put/del` in `frontend/js/api.js`. In mock mode (`AppConfig.useMock()`), `MockService` implements the same contracts.

**Switch to live API:** `localStorage.setItem('railwayUseApi', 'true')` then reload.

---

## Authentication

### POST `/api/auth/login`
- **Purpose:** Authenticate passenger
- **Auth:** No
- **Request:** `{ email, password, captchaId?, captchaAnswer?, rememberMe? }`
- **Response:** `{ token: string }`
- **Errors:** `400` invalid credentials, `403` blocked
- **Frontend:** `AuthPages.initLoginPage()`, `app.js` modal fallback

### POST `/api/auth/register`
- **Purpose:** Create passenger account
- **Auth:** No
- **Request:** `{ name, email, phone, password, captchaId?, captchaAnswer? }`
- **Response:** `{ token: string }`
- **Errors:** `400` user exists / validation

### GET `/api/auth/me`
- **Purpose:** Current user profile
- **Auth:** Yes
- **Response:** `{ id, name, email, phone, isAdmin, isBlocked, createdAt }`

### PUT `/api/auth/profile`
- **Purpose:** Update name/phone
- **Auth:** Yes
- **Request:** `{ name, phone }`

### PUT `/api/auth/change-password`
- **Purpose:** Change password
- **Auth:** Yes
- **Request:** `{ currentPassword, newPassword }`

### POST `/api/auth/forgot-password`
- **Purpose:** Initiate reset
- **Auth:** No
- **Request:** `{ email, captchaId?, captchaAnswer? }`

### POST `/api/auth/reset-password`
- **Purpose:** Complete reset
- **Auth:** No
- **Request:** `{ token, password }`

### GET `/api/captcha`
- **Purpose:** Math captcha challenge
- **Response:** `{ captchaId, question }`

---

## Stations

### GET `/api/stations/search?q={query}`
- **Purpose:** Autocomplete
- **Response:** `[{ id, code, name, city, state }]`

---

## Trains

### GET `/api/trains/search?source=&destination=&date=`
- **Purpose:** Search trains for route/date
- **Response:** `[{ id, trainNumber, trainName, source, destination, departureTime, arrivalTime, duration, runningDays, classes[], date, lowestPrice }]`

### GET `/api/trains`
- **Purpose:** List all trains

### GET `/api/trains/:id/route`
- **Purpose:** Route timeline
- **Response:** `{ stops: [{ stationName, arrivalTime, departureTime, haltMinutes, distanceKm }] }`

### GET `/api/trains/:id/seats?classCode=&date=`
- **Purpose:** Seat map
- **Response:** `{ seats: [{ seatNumber, berthType, isBooked, isAvailable }] }`

---

## Bookings

### POST `/api/bookings`
- **Purpose:** Create booking (Pending / Waitlisted / RAC)
- **Auth:** Yes
- **Request:** `{ trainId, passengers[], journeyDate, classCode, seatNumbers[], bookingType, joinWaitlist, joinRac, quota, captchaId?, captchaAnswer? }`
- **Response:** Booking object with `pnrNumber`, `status`, `totalPrice`

### GET `/api/bookings`
- **Purpose:** User's bookings
- **Auth:** Yes

### GET `/api/bookings/:id`
- **Purpose:** Booking detail
- **Auth:** Yes (owner or admin)

### GET `/api/bookings/pnr/:pnr`
- **Purpose:** PNR lookup (public; limit sensitive fields for guests)

### GET `/api/bookings/:id/refund-preview`
- **Purpose:** Cancellation refund estimate
- **Auth:** Yes

### PUT `/api/bookings/:id`
- **Purpose:** Cancel booking `{ status: 'Cancelled' }`
- **Response:** Booking + `refund` object

### DELETE `/api/bookings/:id/pending`
- **Purpose:** Remove failed-payment Pending booking (optional cleanup)

### GET `/api/bookings/:id/ticket`
- **Purpose:** Download e-ticket (PDF or HTML)

---

## Payments

### GET `/api/payments/config`
- **Response:** `{ devMode: boolean }`

### POST `/api/payments/create-order`
- **Request:** `{ bookingId, amount }`
- **Response:** Razorpay order or `{ devMode: true }`

### POST `/api/payments/dev-confirm`
- **Request:** `{ bookingId }`
- **Response:** `{ booking: confirmedBooking }`

### POST `/api/payments/verify`
- **Purpose:** Razorpay signature verification (production)

---

## Saved Passengers (future backend)

### GET `/api/passengers/saved`
### POST `/api/passengers/saved`
### PUT `/api/passengers/saved/:id`
### DELETE `/api/passengers/saved/:id`

Currently implemented in mock via `Store` + localStorage.

---

## Service adapter mapping

| UI module | Service calls |
|-----------|---------------|
| `auth.js` | login, register, forgot-password |
| `app.js` | search, bookings, PNR, profile, payment |
| `dashboard.js` | bookings, profile, saved passengers (local), search |
| `payment.js` | create-order, dev-confirm, verify |
| `seatMap.js` | trains/:id/seats |
| `captcha.js` | captcha |

---

## Mock persistence (`Store`)

- `railwayStore` — users, bookings, savedPassengers
- `token` — session
- `railwayRecentSearches` — recent searches
- `dashReadNotifs` — notification read state

Demo account (mock seed): **demo@railway.com** / **Demo@123**
