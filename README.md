# AjoSave — Rotational Savings Platform

A fullstack Next.js 16 application for community-based rotational savings (Ajo/Esusu). Members join circles, contribute on a schedule, and receive pooled payouts on their turn.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript) |
| Auth & Database | Firebase (Auth, Firestore, Storage) |
| UI Components | Shadcn/ui + Tailwind CSS 4 |
| Global State | Zustand |
| Server State | TanStack Query v5 |
| Forms | React Hook Form + Zod |
| Animations | Framer Motion |
| Payments | Flutterwave |
| Email | Nodemailer |
| SMS | Termii |
| Charts | Recharts |
| Icons | Lucide React |
| Toasts | Sonner |
| Dates | date-fns |
| Scheduling | Vercel Cron (hits API routes) |

---

## Getting Started

### 1. Clone and install

```bash
git clone <repo-url>
cd ajo-app
npm install
```

### 2. Environment variables

Create `.env.local` at the project root and fill in every value:

```env
# ── Firebase Client (public, safe to expose) ──────────────────────────────────
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# ── Firebase Admin (server only, never expose) ────────────────────────────────
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# ── Flutterwave ───────────────────────────────────────────────────────────────
NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY=
FLUTTERWAVE_SECRET_KEY=
FLUTTERWAVE_ENCRYPTION_KEY=

# ── Nodemailer ────────────────────────────────────────────────────────────────────
NODEMAILER_HOST=
NODEMAILER_PORT=
NODEMAILER_USER=
NODEMAILER_PASS=
NODEMAILER_FROM=

# ── Termii (SMS) ──────────────────────────────────────────────────────────────
TERMII_API_KEY=
TERMII_SENDER_ID=

# ── App ───────────────────────────────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=http://localhost:3000
CRON_SECRET=replace-with-a-long-random-string
```

### 3. Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Firebase Setup

### Console steps
1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Create project → name it `ajo-platform`
3. **Authentication** → Sign-in methods → enable Email/Password and Google
4. **Firestore Database** → Create database → Production mode → choose a region close to Nigeria (e.g. `europe-west1`)
5. **Storage** → Get started → Production mode
6. **Project Settings** → General → Your apps → Add web app → copy the config object into `NEXT_PUBLIC_FIREBASE_*` vars
7. **Project Settings** → Service Accounts → Generate new private key → save the JSON → copy values into `FIREBASE_*` vars

### Firestore Security Rules

Paste these in **Firestore → Rules**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == userId;
    }

    match /circles/{circleId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update: if request.auth.uid == resource.data.adminId
                    || request.auth.uid in resource.data.memberIds;
      allow delete: if request.auth.uid == resource.data.adminId;
    }

    match /contributions/{contributionId} {
      allow read: if request.auth.uid == resource.data.userId
                  || request.auth.uid == get(/databases/$(database)/documents/circles/$(resource.data.circleId)).data.adminId;
      allow create: if request.auth.uid == request.resource.data.userId;
    }

    match /transactions/{txId} {
      allow read: if request.auth.uid == resource.data.userId;
      allow create: if request.auth != null;
    }

    match /wallets/{userId} {
      allow read, write: if request.auth.uid == userId;
    }

    match /notifications/{notifId} {
      allow read, write: if request.auth.uid == resource.data.userId;
    }

    match /invites/{inviteId} {
      allow read: if request.auth.uid == resource.data.senderId
                  || request.auth.uid == resource.data.recipientId;
      allow create: if request.auth != null;
      allow update: if request.auth.uid == resource.data.recipientId;
    }

    match /disputes/{disputeId} {
      allow read: if request.auth.uid == resource.data.raisedBy
                  || request.auth.uid == resource.data.againstUserId;
      allow create: if request.auth != null;
      allow update: if request.auth != null;
    }

    match /bids/{bidId} {
      allow read: if request.auth != null;
      allow create: if request.auth.uid == request.resource.data.userId;
    }
  }
}
```

---

## Folder Structure

```
app/
│   ├── page.tsx                      # public landing page
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx                  # sidebar + header shell
│   │   ├── dashboard/page.tsx
│   │   ├── onboarding/page.tsx         # 3-step first-run flow
│   │   ├── circles/
│   │   │   ├── page.tsx                # my circles list
│   │   │   ├── create/page.tsx
│   │   │   ├── discover/page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── wallet/
│   │   │   ├── page.tsx
│   │   │   └── withdraw/page.tsx
│   │   ├── transactions/page.tsx
│   │   ├── investments/page.tsx
│   │   └── settings/page.tsx
│   ├── (admin)/
│   │   ├── layout.tsx
│   │   └── admin/
│   │       ├── dashboard/page.tsx
│   │       ├── users/page.tsx
│   │       ├── circles/page.tsx
│   │       ├── transactions/page.tsx
│   │       └── disputes/page.tsx       # flagged circles and member disputes
│   ├── api/
│   │   ├── admin/
│   │   │   ├── analytics/
│   │   │   ├── circles/
│   │   │   ├── disputes/
│   │   │   ├── email-health/
│   │   │   ├── investments/
│   │   │   ├── notifications/
│   │   │   ├── server-ip/
│   │   │   ├── settings/
│   │   │   ├── stats/
│   │   │   ├── transactions/
│   │   │   └── users/
│   │   ├── auth/session/route.ts       # set/clear session cookie
│   │   ├── circles/
│   │   │   ├── route.ts                # GET list, POST create
│   │   │   └── [id]/
│   │   │       ├── route.ts            # GET, PATCH, DELETE
│   │   │       ├── join/route.ts       # POST request to join
│   │   │       ├── contribute/route.ts # POST make contribution
│   │   │       └── bid/route.ts        # POST submit payout bid
│   │   ├── payments/
│   │   │   ├── deposit/route.ts        # POST init Flutterwave
│   │   │   ├── withdraw/route.ts       # POST withdraw to bank
│   │   │   └── webhook/route.ts        # POST Flutterwave webhook
│   │   ├── disputes/route.ts           # POST raise dispute
│   │   ├── wallet/route.ts             # GET balance
│   │   └── cron/
│   │       ├── process-payouts/route.ts
│   │       ├── send-reminders/route.ts
│   │       └── apply-penalties/route.ts
│   ├── globals.css
│   └── layout.tsx
│
├── components/
│   ├── ui/                             # shadcn auto-generated, do not edit
│   ├── auth/
│   │   ├── login-form.tsx
│   │   └── register-form.tsx
│   ├── onboarding/
│   │   ├── onboarding-shell.tsx        # step wrapper with progress indicator
│   │   ├── step-profile.tsx            # fill in phone number
│   │   ├── step-fund-wallet.tsx        # make first deposit
│   │   └── step-join-circle.tsx        # join or create first circle
│   ├── dashboard/
│   │   ├── sidebar.tsx
│   │   ├── bottom-nav.tsx              # mobile bottom navigation (5 items)
│   │   ├── mobile-header.tsx
│   │   ├── balance-card.tsx
│   │   ├── stat-card.tsx
│   │   └── recent-transactions.tsx
│   ├── circles/
│   │   ├── circle-card.tsx             # includes contribution progress bar
│   │   ├── circle-card-skeleton.tsx
│   │   ├── circle-hero.tsx
│   │   ├── members-list.tsx
│   │   ├── create-circle-form.tsx
│   │   ├── circle-template-picker.tsx  # preset circle configs
│   │   ├── contribution-dialog.tsx
│   │   ├── bid-dialog.tsx              # bidding order payout bid
│   │   └── join-panel.tsx
│   ├── wallet/
│   │   ├── deposit-modal.tsx
│   │   └── withdraw-form.tsx
│   └── shared/
│       ├── page-header.tsx
│       ├── empty-state.tsx
│       ├── data-table.tsx
│       └── confirm-dialog.tsx
│
├── lib/
│   ├── firebase/
│   │   ├── client.ts                   # initializeApp (client SDK)
│   │   ├── admin.ts                    # initializeApp (admin SDK, server only)
│   │   ├── auth.ts                     # signIn, signOut, onAuthStateChanged helpers
│   │   ├── firestore.ts                # typed read/write helpers
│   │   └── storage.ts                  # upload helpers
│   ├── hooks/
│   │   ├── use-auth.ts                 # current user, loading state
│   │   ├── use-circle.ts               # TanStack Query wrappers for circles
│   │   ├── use-wallet.ts
│   │   └── use-transactions.ts
│   ├── stores/
│   │   ├── auth-store.ts               # Zustand: user, token
│   │   └── ui-store.ts                 # Zustand: sidebar open, modals
│   ├── validators/
│   │   ├── auth.ts                     # Zod schemas for login/register
│   │   ├── circle.ts                   # Zod schemas for circle create/edit
│   │   └── payment.ts                  # Zod schemas for deposit/withdraw
│   ├── services/
│   │   ├── circle-service.ts           # business logic: create, join, payout
│   │   ├── payment-service.ts          # Flutterwave init + verify
│   │   ├── wallet-service.ts           # credit, debit, balance check
│   │   ├── notification-service.ts     # Nodemailer email + Firestore notification
│   │   ├── sms-service.ts              # Termii SMS for contribution reminders
│   │   └── dispute-service.ts          # raise, escalate, resolve disputes
│   ├── utils.ts                        # cn(), formatNaira(), freqLabel() etc
│   └── constants.ts                    # app-wide enums and config values
│
├── types/
│   ├── user.ts
│   ├── circle.ts
│   ├── transaction.ts
│   ├── wallet.ts
│   ├── dispute.ts
│   └── bid.ts
│
└── middleware.ts                       # auth guard using Firebase session cookie
```

---

## Data Models

These are the exact Firestore document shapes. Use these types throughout the app.

### `users/{userId}`
```typescript
interface User {
  id: string                    // Firebase Auth UID
  name: string
  email: string
  phone: string
  avatarUrl?: string
  referralCode: string          // auto-generated on register
  referredBy?: string           // referral code of referrer
  referralBonusAmount: number   // kobo credited per successful referral (see Referral Rules)
  // isVerified: boolean           // KYC removed
  // kycStatus: 'unverified' | 'pending' | 'verified' // KYC removed
  role: 'user' | 'admin'
  status: 'active' | 'suspended' | 'banned'
  circleIds: string[]           // circles this user belongs to
  bankAccounts: BankAccount[]   // saved bank accounts for withdrawals
  onboardingComplete: boolean   // has completed 3-step onboarding flow
  createdAt: Timestamp
  updatedAt: Timestamp
}

interface BankAccount {
  id: string                    // internal ID
  bankCode: string              // Flutterwave bank code
  bankName: string
  accountNumber: string
  accountName: string           // name as returned by bank verification API
  isDefault: boolean
}
```

### `wallets/{userId}`
```typescript
interface Wallet {
  userId: string
  available: number             // available balance in kobo (multiply by 100)
  pending: number               // pending balance in kobo
  totalSaved: number            // lifetime total saved
  totalReceived: number         // lifetime payouts received
  referralEarnings: number      // from referrals
  currency: 'NGN'
  updatedAt: Timestamp
}
```

### `circles/{circleId}`
```typescript
interface Circle {
  id: string
  name: string
  description: string
  adminId: string               // userId of creator
  memberIds: string[]           // ordered list — index = turn position
  maxMembers: number
  contribution: number          // amount in kobo per cycle
  frequency: 'daily' | 'weekly' | 'bi-weekly' | 'monthly'
  payoutOrder: 'rotational' | 'random' | 'bidding'
  status: 'active' | 'paused' | 'completed' | 'cancelled'
  isPrivate: boolean
  currentCycle: number          // which cycle we are on (1-indexed)
  totalCycles: number           // equals maxMembers for rotational
  nextDueDate: Timestamp        // when next contribution is due
  nextPayoutDate: Timestamp     // when next payout happens
  currentRecipientId: string    // userId of who receives payout next
  trustScore: number            // 0-100, computed from payment history
  trustScoreBreakdown: {        // explains why score is what it is
    onTimePayments: number      // count
    latePayments: number
    missedPayments: number
    lastUpdated: Timestamp
  }
  goal: number                  // total pool per cycle in kobo — derive from contribution × maxMembers, never store independently
  saved: number                 // total saved so far in kobo
  creationFee: number           // platform fee paid on creation
  tags: string[]
  pendingRequestIds: string[]   // userIds who requested to join
  inviteCode: string            // short code for sharing
  activeBidId?: string          // current open bid for bidding-order circles
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

### `contributions/{contributionId}`
```typescript
interface Contribution {
  id: string
  circleId: string
  userId: string
  cycle: number
  amount: number                // in kobo
  // Status state machine: pending → paid | late; late → paid | missed
  status: 'pending' | 'paid' | 'late' | 'missed'
  dueDate: Timestamp
  paidAt?: Timestamp
  transactionId?: string        // linked transaction
  penaltyAmount?: number        // in kobo if late
  penaltyPaid?: boolean
  createdAt: Timestamp
}
```

### `transactions/{transactionId}`
```typescript
interface Transaction {
  id: string
  userId: string
  circleId?: string
  type: 'deposit' | 'withdrawal' | 'contribution' | 'payout' | 'penalty' | 'referral_bonus' | 'creation_fee'
  direction: 'credit' | 'debit'
  amount: number                // in kobo
  fee: number                   // platform fee in kobo
  netAmount: number             // amount - fee
  status: 'pending' | 'success' | 'failed' | 'cancelled'
  provider?: 'flutterwave'
  providerReference?: string    // Flutterwave tx ref — used for webhook idempotency checks
  reference: string             // internal reference
  description: string
  meta?: Record<string, unknown>
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

### `notifications/{notificationId}`
```typescript
interface Notification {
  id: string
  userId: string
  type: 'contribution_due' | 'payout_received' | 'member_joined' | 'circle_invite' | 'penalty_applied' | 'dispute_raised' | 'general'
  title: string
  body: string
  read: boolean
  link?: string                 // deep link e.g. /circles/abc
  createdAt: Timestamp
}
```

### `invites/{inviteId}`
```typescript
interface Invite {
  id: string
  circleId: string
  senderId: string
  recipientId?: string          // null if sent via link/code
  recipientEmail?: string
  type: 'invite' | 'request'   // admin invites user OR user requests to join
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled'
  token: string                 // unique token for invite link
  createdAt: Timestamp
  expiresAt: Timestamp
}
```

### `disputes/{disputeId}` _(new)_
```typescript
interface Dispute {
  id: string
  circleId: string
  raisedBy: string              // userId who raised the dispute
  againstUserId?: string        // optional: dispute against a specific member
  type: 'missed_payout' | 'admin_abuse' | 'fraudulent_member' | 'other'
  description: string
  status: 'open' | 'under_review' | 'resolved' | 'dismissed'
  resolution?: string           // admin notes on resolution
  resolvedBy?: string           // admin userId
  resolvedAt?: Timestamp
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

### `bids/{bidId}` _(new)_
```typescript
interface Bid {
  id: string
  circleId: string
  cycle: number                 // which payout cycle this bid is for
  userId: string                // bidder
  amount: number                // bid premium in kobo (on top of regular payout)
  status: 'active' | 'won' | 'lost' | 'cancelled'
  deadline: Timestamp           // bids close 24h before nextPayoutDate
  createdAt: Timestamp
}
```

---

## API Routes

All API routes validate the Firebase session cookie using the Admin SDK before processing.

### Auth
| Method | Route | Description |
|---|---|---|
| POST | `/api/auth/session` | Create session cookie after Firebase sign-in |
| DELETE | `/api/auth/session` | Clear session cookie on logout |

### Circles
| Method | Route | Description |
|---|---|---|
| GET | `/api/circles` | List all public circles |
| POST | `/api/circles` | Create a new circle |
| GET | `/api/circles/[id]` | Get circle details |
| PATCH | `/api/circles/[id]` | Update circle (admin only) |
| DELETE | `/api/circles/[id]` | Delete circle (admin only) |
| POST | `/api/circles/[id]/join` | Request to join |
| POST | `/api/circles/[id]/contribute` | Make a contribution |
| POST | `/api/circles/[id]/bid` | Submit a payout bid (bidding circles only) |

### Payments
| Method | Route | Description |
|---|---|---|
| POST | `/api/payments/deposit` | Initialize Flutterwave payment |
| POST | `/api/payments/withdraw` | Withdraw to bank account |
| POST | `/api/payments/webhook` | Flutterwave webhook handler |

### Disputes
| Method | Route | Description |
|---|---|---|
| POST | `/api/disputes` | Raise a new dispute |
| PATCH | `/api/disputes/[id]` | Update dispute status (admin only) |

### Cron (protected by `CRON_SECRET` header)
| Method | Route | Schedule | Description |
|---|---|---|---|
| GET | `/api/cron/process-payouts` | `0 9 * * *` | Trigger due payouts |
| GET | `/api/cron/send-reminders` | `0 8 * * *` | Send contribution reminders |
| GET | `/api/cron/apply-penalties` | `0 0 * * *` | Apply late payment penalties |

---

## Scheduling with Vercel Cron

Add `vercel.json` at the project root:

```json
{
  "crons": [
    {
      "path": "/api/cron/process-payouts",
      "schedule": "0 9 * * *"
    },
    {
      "path": "/api/cron/send-reminders",
      "schedule": "0 8 * * *"
    },
    {
      "path": "/api/cron/apply-penalties",
      "schedule": "0 0 * * *"
    }
  ]
}
```

Every cron route must check the secret header:

```typescript
// app/api/cron/process-payouts/route.ts
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }
  // ... payout logic
}
```

---

## Auth Flow

1. User signs in with Firebase Auth (client side)
2. Client calls `POST /api/auth/session` with the Firebase ID token
3. Server verifies token with Admin SDK, creates an `httpOnly` session cookie (14 day expiry)
4. All subsequent API calls read the session cookie — no token in localStorage
5. `middleware.ts` checks the session cookie and redirects unauthenticated users to `/login`
6. On logout, client calls `DELETE /api/auth/session` to clear the cookie, then signs out of Firebase

---

## Business Logic Rules

These rules must be enforced in the service layer.

### Circles
- Creation fee = 5% of contribution amount, deducted from wallet at creation
- Admin is always turn position 1 in rotational circles
- A circle can only start payouts when all member slots are filled
- Pausing a circle freezes all due dates and payout dates — only the admin can pause/unpause; this must be enforced in `circle-service.ts`, not as a raw status patch
- A member can only be in a maximum of 10 active circles

- `goal` is always derived as `contribution × maxMembers` — never store it independently; derive it at read time to prevent stale values

### Contributions

Contribution status must follow this state machine — no ad-hoc status strings outside of it:

```
pending ──► paid     (on successful payment)
pending ──► late     (48h grace period passes with no payment)
late    ──► paid     (late payment made; penalty collected first)
late    ──► missed   (no payment after X additional days)
```

- Contributions are due on `nextDueDate`
- Grace period = 48 hours after due date before marking as `late`
- Late contributions attract a 10% penalty on the contribution amount
- Three consecutive missed payments = automatic removal from circle
- Contribution deducts from available wallet balance (must have sufficient funds)

### Payouts
- Payout = `contribution × memberCount` sent to `currentRecipientId`'s wallet
- After payout, `currentCycle` increments and `currentRecipientId` advances to next member
- **Random order:** draw happens at payout time, winner determined by secure random selection
- **Bidding order:** bids are stored in `bids/{bidId}`; the highest bidder pays their bid premium into the pool and receives the payout early; bids close 24h before `nextPayoutDate`; bid premium goes to the pool (distributed equally to non-winning members), not to the platform
- Platform takes 1% of each payout as a fee

### Referrals
- Referrer earns ₦500 (50,000 kobo) credited to their wallet when a referee completes their first deposit of ₦1,000 or more
- Referral bonus is a `referral_bonus` transaction of type `credit`
- A referrer can earn from a maximum of 50 referrals per calendar month (fraud prevention)

### Wallet
- All amounts stored in **kobo** (1 NGN = 100 kobo) to avoid floating point
- Minimum deposit: ₦500
- Minimum withdrawal: ₦1,000
- Withdrawal fee: 1% + ₦50 flat, capped at ₦500
- Withdrawal requires at least one verified `bankAccount` on the user's profile
- Bank account must be verified via Flutterwave's account resolution API before saving

### Webhook Idempotency
- Before crediting any wallet on a deposit webhook, check whether a transaction with the same `providerReference` already exists in Firestore
- If it exists, return `200` immediately without processing — do not double-credit
- This check must happen inside a Firestore `runTransaction()` to prevent race conditions under concurrent webhook retries

---

## Payments (Flutterwave)

### Deposit flow
1. Client calls `POST /api/payments/deposit` with `{ amount }`
2. Server initializes Flutterwave payment link
3. Client redirects to Flutterwave checkout
4. On success, Flutterwave hits `POST /api/payments/webhook`
5. Webhook verifies signature, checks idempotency, credits wallet, creates transaction record

### Withdrawal flow
1. Client calls `POST /api/payments/withdraw` with `{ amount, bankAccountId }`
2. Server resolves the saved bank account from `user.bankAccounts`
3. Server initiates a Flutterwave Transfer (not a payment link)
4. Flutterwave hits `POST /api/payments/webhook` with `transfer.completed` or `transfer.failed`
5. Webhook updates transaction status and notifies user

### Webhook verification
```typescript
// Always verify the Flutterwave signature
const hash = crypto
  .createHmac('sha256', process.env.FLUTTERWAVE_SECRET_KEY!)
  .update(JSON.stringify(payload))
  .digest('hex')

if (hash !== request.headers.get('verif-hash')) {
  return new Response('Invalid signature', { status: 401 })
}
```

---

## Email Templates (Nodemailer)

Send emails for these events:

| Trigger | Template |
|---|---|
| Registration | Welcome + verify email |
| Contribution due (24h before) | Reminder with amount and circle name |
| Contribution received | Receipt |
| Payout received | Payout notification with amount |
| Late payment | Warning + penalty amount |
| Circle invite | Invite link |

| Dispute raised | Confirmation to reporter + notification to admin |
| Dispute resolved | Resolution notice to reporter |

---

## SMS Notifications (Termii)

Email open rates in Nigeria are low. Use Termii as the primary channel for time-sensitive alerts and email as a fallback/receipt channel.

| Trigger | Channel |
|---|---|
| Contribution due (24h before) | SMS (primary) + Email (fallback) |
| Contribution received | SMS |
| Payout received | SMS + Email |
| Late payment warning | SMS |

```typescript
// lib/services/sms-service.ts
export async function sendSms(phone: string, message: string) {
  await fetch('https://api.ng.termii.com/api/sms/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: phone,
      from: process.env.TERMII_SENDER_ID,
      sms: message,
      type: 'plain',
      api_key: process.env.TERMII_API_KEY,
      channel: 'generic',
    }),
  })
}
```

---

## Onboarding Flow

New users who have not yet completed onboarding (`user.onboardingComplete === false`) are redirected to `/onboarding` after login. The flow has three steps:

1. **Complete your profile** — add phone number (required for SMS notifications and withdrawal verification)
2. **Fund your wallet** — make a first deposit (minimum ₦500); shows a Flutterwave deposit modal inline
3. **Join or create a circle** — browse public circles or create one; can be skipped

On completion, set `user.onboardingComplete = true` and redirect to `/dashboard`.

---

## Bidding System

For circles with `payoutOrder: 'bidding'`:

- When a new payout cycle begins, an open `Bid` document is created for that cycle
- Members submit bids via `POST /api/circles/[id]/bid` with `{ amount }` (bid premium in kobo, on top of their regular contribution)
- Bid deadline = 24 hours before `nextPayoutDate`
- After the deadline, the highest bid wins; the winner pays their regular contribution **plus** their bid premium
- The bid premium is split equally among all non-winning members as a bonus to the pool
- The platform takes its 1% payout fee on the full payout amount (base pool + premium)
- If no bids are placed before the deadline, the payout falls back to rotational order

---

## Dispute System

Any member can raise a dispute against a circle or specific member:

1. Member calls `POST /api/disputes` with `{ circleId, type, description, againstUserId? }`
2. A `Dispute` document is created with `status: 'open'`
3. Admin receives an in-app notification and email
4. Admin reviews and updates status to `'under_review'` or resolves it
5. On resolution, the reporter receives an in-app notification + email with the outcome

Dispute types: `missed_payout`, `admin_abuse`, `fraudulent_member`, `other`.

---

## Important Implementation Notes

> Read this section before writing any code.

1. **All amounts are in kobo** — multiply by 100 before storing, divide by 100 before displaying. Use `formatNaira(amount / 100)` everywhere.

2. **Never trust the client** — all business logic (wallet deductions, payout processing, penalty application) runs in API routes using the Admin SDK, never client-side Firestore writes.

3. **Firestore transactions** — use `runTransaction()` for any operation that reads then writes (e.g. checking wallet balance then deducting, idempotency checks on webhooks). This prevents race conditions.

4. **Session cookie auth** — every API route calls `getSessionUser(request)` which verifies the `httpOnly` cookie via Admin SDK. Never use client-side Firebase Auth tokens in API routes.

5. **TanStack Query for all data fetching** — no raw `useEffect` + `fetch` patterns. Every piece of server data goes through a query or mutation.

6. **Zustand only for UI state** — sidebar open/close, modal state, selected items. Server data lives in TanStack Query cache, not Zustand.

7. **Zod on both sides** — validate with Zod in the API route (server) AND in React Hook Form (client). Share the same schema file between both.

8. **Error handling** — API routes always return `{ success, data, error }` shaped responses. Never throw unhandled errors to the client.

9. **Optimistic updates** — use TanStack Query's `onMutate` for contributions and reads so the UI feels instant.

10. **Mobile first** — every component is built mobile-first. The dashboard sidebar collapses to a bottom nav on mobile (5 items: Home, Circles, Wallet, Notifications, Profile).

11. **Webhook idempotency** — always check `providerReference` uniqueness before crediting a wallet. Duplicate webhooks from Flutterwave are common.



13. **`goal` is derived, never stored** — always compute `contribution × maxMembers` at read time. Storing it risks it going stale if `contribution` or `maxMembers` is ever updated.

14. **Contribution state machine** — only transition contribution statuses according to the defined state machine. Never set a status to an arbitrary value outside the allowed transitions.

---

## Color Palette & Design System

### Brand Colors

```css
/* Emerald brand palette */
--primary:       #047857;   /* emerald-700 */
--primary-light: #d1fae5;   /* emerald-100 */
--primary-dark:  #064e3b;   /* emerald-900 */

/* Neutrals */
--background: #f9fafb;
--surface:    #ffffff;
--border:     #e5e7eb;

/* Semantic */
--success: #10b981;   /* emerald-500 */
--warning: #f59e0b;   /* amber-400 */
--pending: #f59e0b;   /* alias of --warning — use for 'pending' states */
--late:    #f97316;   /* orange-500 — distinct from danger, for 'late' contributions */
--danger:  #ef4444;   /* red-500 */
--info:    #3b82f6;   /* blue-500 */
```

### Dark Mode Tokens

Define these before building components — retrofitting dark mode is expensive.

```css
--background-dark:    #0f1a16;
--surface-dark:       #1a2e24;
--border-dark:        #2d4a3e;
--primary-dark-mode:  #34d399;   /* emerald-400 — lighter for contrast on dark bg */
```

### Typography Scale

| Token | Font | Size | Weight | Use |
|---|---|---|---|---|
| `display` | Playfair Display | 36px / 2.25rem | 700 | Hero headings |
| `h1` | Playfair Display | 28px / 1.75rem | 600 | Page titles |
| `h2` | DM Sans | 20px / 1.25rem | 600 | Section headers |
| `body` | DM Sans | 15px / 0.9375rem | 400 | All body copy |
| `caption` | DM Sans | 12px / 0.75rem | 400 | Labels, metadata |
| `mono` | JetBrains Mono | 14px / 0.875rem | 400 | Naira amounts, transaction references |

> Use `mono` for all Naira amounts in transaction lists — proportional digits cause column alignment jitter.

Font loading (`app/layout.tsx`):
```typescript
import { Playfair_Display, DM_Sans, JetBrains_Mono } from 'next/font/google'
```

### Number Formatting

| Context | Format | Example |
|---|---|---|
| Transaction history | Full with pence | ₦5,000.00 |
| Cards and summaries | Compact | ₦5,000 or ₦5k |
| Raw kobo | Never shown to user | — |

Implement in `lib/utils.ts`:
```typescript
export function formatNaira(kobo: number, compact = false): string {
  const naira = kobo / 100
  if (compact && naira >= 1000) {
    return `₦${(naira / 1000).toFixed(1)}k`
  }
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: compact ? 0 : 2,
  }).format(naira)
}
```

### Contribution Progress Bar

Every `CircleCard` shows a progress bar derived from `saved / goal`:

| Progress | Color |
|---|---|
| 0–49% | `--info` (blue) |
| 50–79% | `--warning` (amber) |
| 80–100% | `--success` (emerald) |

### Empty States

Every list screen must render a meaningful empty state via `<EmptyState />`:

| Screen | Message |
|---|---|
| My Circles | "You're not in any circles yet. Create one or browse public circles." |
| Discover | "No public circles available right now. Check back soon." |
| Transactions | "No transactions yet. Fund your wallet to get started." |
| Notifications | "You're all caught up. No new notifications." |
| Admin / Users | "No users match your search." |

### Loading Skeletons

Every data-driven card must have a skeleton variant (not a spinner). Build skeleton components alongside their real counterparts:

- `circle-card-skeleton.tsx`
- `balance-card-skeleton.tsx`
- `transaction-row-skeleton.tsx`
- `stat-card-skeleton.tsx`

### Destructive Action Dialogs

Wire `<ConfirmDialog />` to every destructive action. The dialog must state the specific consequence — not just "Are you sure?":

| Action | Dialog message |
|---|---|
| Leave circle | "You will lose your position in this circle. You cannot rejoin unless the admin re-invites you." |
| Delete circle | "This will permanently delete the circle and cancel all pending contributions. This cannot be undone." |
| Withdraw | "₦X,XXX will be sent to [Bank Name] •••• 1234. A fee of ₦XX will be deducted." |
| Remove member (admin) | "This member will be removed from the circle and their pending contributions cancelled." |

### Mobile Bottom Navigation

On screens narrower than `md` (768px), the sidebar is replaced by a bottom navigation bar with exactly 5 items:

| Tab | Icon | Route |
|---|---|---|
| Home | `Home` | `/dashboard` |
| Circles | `Users` | `/circles` |
| Wallet | `Wallet` | `/wallet` |
| Notifications | `Bell` (with unread badge, capped at 99+) | `/notifications` |
| Profile | `User` | `/settings` |

---

## Scripts

```bash
npm run dev          # start dev server
npm run build        # production build
npm run lint         # ESLint
npm run type-check   # tsc --noEmit
```

---

## Deployment (Railway)

1. Push to GitHub
2. Create Railway project → Deploy from GitHub repo
3. Add PostgreSQL plugin (if migrating from Firestore later)
4. Set all environment variables in Railway dashboard
5. Railway auto-detects Next.js and deploys

For Vercel (cron jobs):
1. Connect GitHub repo to Vercel
2. Set environment variables in Vercel dashboard
3. Add `vercel.json` with cron config
4. Cron jobs only run on Pro plan ($20/month) — Hobby plan supports 1 cron job

---

## Pre-Build Checklist

Before writing any code, ensure the following are fully specified:

- [ ] Bidding system — bid storage, premium distribution, deadline handling ✅ (see Bidding System section)
- [ ] Bank account model on `User` ✅ (see Data Models)
- [ ] Withdrawal flow via Flutterwave Transfer API ✅ (see Payments)
- [ ] Webhook idempotency logic ✅ (see Implementation Notes)
- [ ] Referral bonus rules ✅ (see Business Logic Rules)
- [ ] Onboarding flow ✅ (see Onboarding Flow)

- [ ] Dispute system ✅ (see Dispute System)
- [ ] SMS provider (Termii) ✅ (see SMS Notifications)
- [ ] Dark mode tokens ✅ (see Design System)

---

## License

Private — AjoSave © 2025