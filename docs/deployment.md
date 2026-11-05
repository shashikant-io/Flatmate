# FlatMate deployment

FlatMate uses Firebase only:

- Vercel for the React/Vite frontend
- Firebase Authentication for users
- Cloud Firestore for expenses and flat data
- Firebase Storage for item and receipt images
- Firebase Cloud Functions for protected server-side operations

## Local setup

```powershell
npm install
cd functions
npm install
cd ..
npm run build
cd functions
npm run build
cd ..
```

The Firebase project is configured in [.firebaserc](../.firebaserc). Frontend Firebase values are in the local `.env` file and must not be committed.

## Deploy frontend to Vercel

Vercel dashboard mein project import karke:

- Framework: `Vite`
- Build command: `npm run build`
- Output directory: `dist`

Vercel Environment Variables mein `.env` ke saare `VITE_FIREBASE_*` values add karein:

```text
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_MEASUREMENT_ID
VITE_FIREBASE_FUNCTIONS_REGION
```

CLI se deploy:

```powershell
npm install -g vercel
vercel login
vercel
vercel --prod
```

`vercel.json` SPA rewrite provide karta hai, isliye browser refresh par app route nahi tootega.

## Deploy Firebase services

Install and authenticate with the Firebase CLI:

```powershell
npm install -g firebase-tools
firebase login
firebase use split-fb4f9
npm run deploy:firebase
```

Firebase deploy command frontend deploy nahi karega; yeh Firestore rules/indexes, Storage rules, aur Cloud Functions deploy karega:

```powershell
firebase login
firebase use split-fb4f9
firebase deploy --only firestore,storage,functions
```

## Data locations

- `flats/{flatId}/expenses/{expenseId}` — expenses
- `flats/{flatId}/members/{uid}` — flat membership
- `flats/{flatId}/settlements/{settlementId}` — settlement records
- `users/{uid}` — user profile data
- `flats/{flatId}/...` in Storage — private images and receipts

The security rules require an authenticated user and flat membership before reading or writing shared data.

## Invitations

Flat creation, invitation creation, invitation acceptance, and expense creation run through callable
Functions in `functions/src/index.ts`. Invitation emails are queued in the `/mail` collection for the
Firebase Trigger Email extension. Install and configure that extension with a transactional email
provider (for example SMTP, SendGrid, or Mailgun) before using invitations in production. Provider
credentials stay in the extension configuration and are never exposed to the frontend.

Invitation codes are stored as SHA-256 hashes, expire after seven days, can only be accepted by the
invited email address, and become `accepted` after the membership transaction succeeds.

## PWA

The Vercel build publishes `public/manifest.webmanifest` and `public/sw.js`. The service worker
caches the application shell for offline startup. Firestore remains the source of truth; an offline
expense must not be presented as synchronized until Firestore acknowledges the write.
