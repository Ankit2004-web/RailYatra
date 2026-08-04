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

### POST `/api/payments/webhook`
- **Purpose:** Razorpay server-to-server webhook (`payment.captured`, `refund.processed`)
- **Auth:** No (uses `x-razorpay-signature` HMAC with `RAZORPAY_WEBHOOK_SECRET`)
- **Body:** Raw JSON from Razorpay

---

## Saved Passengers

### GET `/api/passengers/saved`
- **Purpose:** List saved passengers for the logged-in user
- **Auth:** Yes
- **Response:** `[{ id, name, age, gender, berthPreference }]`

### POST `/api/passengers/saved`
- **Purpose:** Add a saved passenger
- **Auth:** Yes
- **Request:** `{ name, age, gender, berthPreference? }`

### PUT `/api/passengers/saved/:id`
- **Purpose:** Update a saved passenger
- **Auth:** Yes

### DELETE `/api/passengers/saved/:id`
- **Purpose:** Remove a saved passenger
- **Auth:** Yes

**Frontend:** `ProfilePage` (manage list), `BookingPage` (picker to autofill passenger forms)

---

## Service adapter mapping

| UI module | Service calls |
|-----------|---------------|
| `AuthContext` / auth pages | login, register, forgot-password, profile |
| `BookingPage` | bookings, payments, passengers/saved |
| `BookingsPage` | bookings, payments, ticket download |
| `ProfilePage` | profile, passengers/saved |
| `PnrPage` | bookings/pnr |
| `paymentFlow.js` | create-order, dev-confirm, verify |
| `AdminDashboardPage` | admin/*, waitlist/rac promote |

---

## Notes

- Demo accounts removed — set `ADMIN_EMAIL` + `ADMIN_PASSWORD` for seed admin.
- Requires Node.js 20.x or 22.x LTS (see `.nvmrc`).
