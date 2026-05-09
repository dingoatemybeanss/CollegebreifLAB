# College Brief Lab

  A React + Vite + Firebase app for building structured college application briefs, policy memos, and debate cases.

  ## Setup

  ```bash
  npm install        # or: pnpm install / yarn install
  ```

  Copy `.env.example` to `.env.local` and fill in your Firebase credentials:

  ```bash
  cp .env.example .env.local
  ```

  Then start the dev server:

  ```bash
  npm run dev
  ```

  ## Deploying to Vercel

  1. Push this folder to a GitHub repo.
  2. Import the repo in Vercel — it will auto-detect Vite.
  3. Add the `VITE_*` environment variables from `.env.example` in the Vercel dashboard under **Settings → Environment Variables**.
  4. Add your Vercel deployment domain to **Firebase Console → Authentication → Authorized domains**.

  ## Firebase setup

  - Enable **Google sign-in** in Firebase Console → Authentication → Sign-in method.
  - Create a **Firestore** database in production mode.
  - Add these security rules to Firestore:

  ```
  rules_version = '2';
  service cloud.firestore {
    match /databases/{database}/documents {
      match /briefs/{docId} {
        allow read, write: if request.auth != null && resource.data.uid == request.auth.uid;
        allow create: if request.auth != null && request.resource.data.uid == request.auth.uid;
      }
      match /opportunities/{docId} {
        allow read, write: if request.auth != null && resource.data.uid == request.auth.uid;
        allow create: if request.auth != null && request.resource.data.uid == request.auth.uid;
      }
      match /stats/{uid} {
        allow read, write: if request.auth != null && request.auth.uid == uid;
      }
      match /users/{uid} {
        allow read: if request.auth != null && request.auth.uid == uid;
      }
    }
  }
  ```
  