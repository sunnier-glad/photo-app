# Photo App

Photo App is a mobile-first photo and video manager with personal albums, favorites, a recoverable trash, shared spaces, friend messaging, and an Android client. The interface is primarily Chinese and the repository contains the React frontend, Express API, Prisma schema, automated tests, and Capacitor Android project.

## Features

- Personal albums with photo/video upload, favorites, cached media, and swipe navigation.
- Cleanup and trash flows with multi-selection, restore, permanent deletion, and a full-screen viewer.
- Shared spaces where members can upload media and delete only items they uploaded.
- Email registration, JWT authentication, profiles, personal IDs, friends, invitations, and messages.
- Aliyun OSS direct uploads with server-generated policies and signed read URLs.
- Optional MiMo-assisted photo titles and an in-app Android update manifest.

## Tech Stack

- Frontend: React 19, TypeScript, Vite 6, Tailwind CSS 4, Motion, Lucide React.
- Backend: Express, Prisma, MySQL, JWT, Zod, Nodemailer.
- Storage: Aliyun OSS with server-side signing and client-side media caching.
- Mobile: Capacitor 6 and the Android Gradle toolchain.
- Tests: Node test runner through `tsx`, plus TypeScript type checking.

## Project Structure

```text
src/                         React application, hooks, utilities, and frontend tests
server/src/                  Express API and domain modules
server/tests/                Backend unit and integration tests
server/prisma/schema.prisma  MySQL data model
android/                     Capacitor Android application
assets/                      Source application artwork
release/memories/            Public update-manifest example
```

## Prerequisites

- Node.js 20 or newer and npm.
- MySQL 8 or a compatible MySQL server.
- An Aliyun OSS bucket and access credentials for upload features.
- SMTP credentials if email verification should send real messages.
- JDK 17, Android SDK, and Gradle-compatible Android tooling for APK builds.

## Environment Setup

Install the locked dependencies and create a local environment file:

```powershell
npm ci
Copy-Item .env.example .env
```

Update `.env` with your own database, JWT, OSS, and optional SMTP/MiMo credentials. Never commit `.env`. OSS access keys are consumed only by the backend and must not be exposed through `VITE_*` variables.

## Database Setup

Create the development database:

```sql
CREATE DATABASE memories CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Generate Prisma Client and apply the schema:

```powershell
npm run prisma:generate
npm run prisma:migrate -- --name init_memories_backend
```

Use `npm run prisma:studio` when you need the Prisma data browser.

## Development

Start the API server:

```powershell
npm run dev:server
```

Start the frontend in another terminal:

```powershell
npm run dev
```

The frontend defaults to `http://localhost:4000/api` and Vite serves the application on port `3000`.

## Tests and Validation

```powershell
npm run prisma:generate
npm run test:frontend
npm run test:server
npm run lint
npm run build
```

## Android Build

Build and synchronize the web application, then assemble a debug APK:

```powershell
npm run apk:debug
```

The generated APK is written to `android/app/build/outputs/apk/debug/app-debug.apk` and is ignored by Git. For a physical device using a development API, set `VITE_API_BASE_URL` to a reachable development host before building.

## Runtime Configuration

- `VITE_API_BASE_URL` controls the frontend API endpoint and defaults to `http://localhost:4000/api`.
- `VITE_UPDATE_MANIFEST_URL` controls the Android update manifest and defaults to an `example.com` placeholder.
- `DATABASE_URL`, `JWT_SECRET`, `OSS_*`, and `SMTP_*` configure the backend.
- `MIMO_API_KEY`, `MIMO_BASE_URL`, and `MIMO_MODEL` configure the optional title assistant.
- `release/memories/version.json` is an example manifest; replace its placeholder APK URL for your own deployment.

## Security Notes

- Keep `.env`, credentials, signing keys, APKs, and build output outside version control.
- Use least-privilege OSS credentials and rotate any credential that may have been exposed.
- Public defaults intentionally use `localhost` and `example.com`; configure deployment URLs through environment variables.
- The checked-in debug Android configuration permits cleartext traffic for local HTTP development. Production builds should use HTTPS and set `android:usesCleartextTraffic="false"`.
- Review dependency audit results before deploying and test upgrades before applying breaking security fixes.

## License

Licensed under the Apache License, Version 2.0. See `LICENSE`.
