# LS-Shop — Grocery Store Platform

A React + TypeScript grocery app with a Firebase backend and an explicitly labelled, device-local demo. Built from the attached Grocery Store Platform implementation plan.

**Delivery status:** Configured for Firebase project `ls-shop-59a3d`. Production builds use the supplied Web app configuration in `.env.production`; local development remains a labelled demo unless `.env.local` is configured. Deployment authentication, sender verification, and the remaining acceptance items below are still needed.

## Try it on Windows

1. Extract this ZIP into a folder.
2. Install Node.js 22 LTS if it is not installed.
3. Double-click `START-WINDOWS.bat`.
4. Open `http://127.0.0.1:5173` after the terminal says Vite is ready. Refresh if your browser opened before installation finished.
5. Browse products, place a demo pickup order, then click **Try shop owner view** to manage it.

The demo uses sample data and local browser storage. It does not send orders to real shops, create real accounts, upload files, or send email. Refreshing preserves demo changes. Each browser/device has separate demo data. Demo state never becomes production data automatically.

Alternatively:

```sh
npm ci
npm run dev
```

## Implemented workflows

- Multiple store addresses using `?store=store-slug` and independent owner accounts.
- Product search, categories, descriptions, photos, fixed packs/weights, sale prices, hidden products, stock availability, and basket quantity controls.
- Pickup/delivery checkout with postal coverage, minimum value, future dates, configured time slots, slot capacity, taxes, fees, and authoritative totals.
- Firebase anonymous guest identity: guests can access their own orders on the same browser. Linking an email/password account preserves that guest identity and order access. Signing out of an anonymous session or clearing browser data loses guest access; register first.
- Owner overview, catalog creation/editing, authenticated image uploads, stock updates, and fulfillment transitions.
- Separate fulfillment and payment status. Recording cash received is explicit. Refund recording records money already refunded outside the app; the app does not move money.
- Customer enrollment, owner credit approval, credit limits, pending credit reservations, acceptance charges, previous dues, partial payments, oldest-charge allocation, and linked reversals with reasons and audit records.
- In-app due notices and customer statements.
- Scheduled email reminder implementation with due-day/day-3/repeat timing, store time zones, verification checks, daily suppression, provider idempotency, balance recheck, and sent/skipped/failed/unknown history. Real email remains disabled until configured.
- Page/section editor with banners, text, images, collections, categories, links, contact blocks, section drag/reorder, columns, page navigation labels, undo/redo, draft save, atomic page-set publication, and revision restoration into draft.
- Store name, logo URL, font selection, brand color, regional settings, and fulfillment settings.
- Platform-admin store suspension/restoration, using a server-managed custom claim.
- Firestore and Storage rules; all authoritative writes go through callable functions. A client cannot directly change a balance, price snapshot, stock reservation, ownership, or fulfillment status.

## Firebase setup

1. Use your intended Google account to create or select a Firebase project. Choose the Firestore region deliberately; it cannot simply be changed later. Configure billing for Functions/Scheduler/Storage as required by your project.
2. Register a Web app. Copy `.env.example` to `.env.local`, and fill all `VITE_FIREBASE_*` fields from that Web app configuration. These are browser app settings, not service-account secrets.
3. Enable Email/Password and Anonymous providers in Firebase Authentication. Add your hosting domain to authorized domains. Configure password policy and verification templates.
4. Create Firestore and Storage. Set the correct bucket in the frontend configuration. Deploy the supplied rules rather than enabling public writes.
5. Install backend dependencies:

   ```sh
   npm ci --prefix functions
   npx firebase login
   npx firebase use --add
   ```

6. Choose the Functions region. Its default is `us-central1`. If changing it, set both frontend `VITE_FUNCTIONS_REGION` and backend `FUNCTIONS_REGION` in the deployment environment consistently.
7. Run the verification commands below. Resolve any failing acceptance gate before enabling production deployment.
8. Build and deploy:

   ```sh
   npm run build
   npm --prefix functions run build
   npx firebase deploy --project YOUR_PROJECT_ID
   ```

9. Open the generated Hosting URL. Create a real account, select **Open your store**, configure country/currency before adding products, then add your catalog. New production stores start empty.

`npm run build` loads the committed `.env.production` and connects to `ls-shop-59a3d`. `npm run dev` remains a device-local demo. Analytics is not activated automatically; the measurement ID is retained in configuration.

## Email setup

The included sender adapter uses Resend's HTTPS endpoint. No customer emails were sent during development.

- Verify a sending domain and sender in your email provider.
- Set `EMAIL_API_KEY` using `npx firebase functions:secrets:set EMAIL_API_KEY --project YOUR_PROJECT_ID`.
- Configure `EMAIL_FROM` and `ENABLE_REMINDER_EMAILS=true` only for the production project. Start from `functions/.env.example`. Keep actual environment values and secrets outside Git.
- For staging and emulators, leave `ENABLE_REMINDER_EMAILS=false`.
- Deploy functions after configuration.

An attempted or unknown result is never blindly retried. Review unknown deliveries manually. A provider send cannot be atomic with a simultaneous ledger payment: the code rechecks immediately before sending, but a payment after that final read can still race with delivery. The message explicitly accounts for recently received payments. Provider-level delivery/bounce webhook reconciliation is not implemented.

## GitHub Actions

`.github/workflows/verify-and-deploy.yml` runs dependency installation, domain tests, UI component tests, Firestore rule tests, transaction tests, callable transport tests, and builds.

Deployment is gated by `ENABLE_FIREBASE_DEPLOY=true`, successful verification, and the `production` environment. Configure Workload Identity Federation and a project-scoped deployment service account using the repository variables referenced in the workflow. Do not commit service-account JSON.

Deployment repository variables (the Web app settings are already configured):

- `ENABLE_FIREBASE_DEPLOY`
- `GCP_WORKLOAD_IDENTITY_PROVIDER`
- `GCP_DEPLOY_SERVICE_ACCOUNT`

Target repository: https://github.com/lazystudent420-dot/LS-Shop (currently public). The production Web app configuration is intentionally client-visible; service-account credentials and email secrets must never be committed.

## Verification

```sh
npm test
npm run test:ui
npm run test:rules
npm run test:transactions
npm run test:functions
npm run build
npm --prefix functions run build
```

Emulator commands require Java; use Java 21 in CI. The transaction test invokes the actual callable handler with test auth context against Firestore Emulator; it verifies simultaneous purchases and idempotent retries. The separate callable transport test exercises Firebase Authentication and the Functions HTTP emulator.

See `VERIFICATION.md` for what actually ran and the environment limits. UI component tests are not a substitute for visual/mobile browser acceptance testing.

## Architecture and operational limits

- `src/main.tsx`: storefront, account, owner workspace, and section editor.
- `src/api.ts`: Firebase adapter; demo adapter is isolated behind missing Firebase configuration.
- `functions/src/engine.mjs`: pure authoritative business logic shared by demo and server tests.
- `functions/src/index.mjs`: Firebase callable endpoints, transactional repository, reminders.
- Financial data and orders are separate Firestore documents under each store. Public catalogs are projected separately.
- The current repository reads a store's complete record set inside a transaction and writes only changed records, with a store-root revision lock. This is intended for a small pilot, not an unrestricted, high-volume SaaS launch. Read cost grows with store history, transactions contend on the store root, and view payloads grow. Before scaling, implement targeted queries, pagination, explicit reservation documents, bounded request history, and paginated reminder batches.
- Money uses integer currency minor units. Currency is locked after products or financial activity exist. There is no currency migration tool.
- Packs/weights are separate sellable product records (for example, rice 500 g and rice 1 kg). Arbitrary fractional weighed checkout and nested variant groups are not implemented.
- Delivery coverage is an explicit postal-code allowlist. There is no automatic address validation service.
- Store configuration changes apply immediately; the draft/publish boundary protects page sets. There is no draft versioning of global branding settings.
- Store links currently use query-string slugs. Custom domains, subdomains, and ownership verification for domain assignment are not implemented.

## Remaining launch acceptance work

- Configure the Firebase project and intended private repository; run the full HTTP callable suite in a supported environment and verify a deployed staging instance.
- Run real desktop/mobile visual and keyboard QA. Dialog focus trapping and Escape dismissal are implemented; complete screen-reader and keyboard testing still require acceptance verification.
- Validate image uploads against Storage Emulator and production Storage, including malformed/spoofed image contents. Rules currently validate declared content type and size; server-side image decoding/re-encoding is not implemented.
- Test verified-sender reminder delivery, bounce handling, failure recovery, and time-zone edge cases with your provider. Scheduled delivery was not live-tested.
- Configure and actually test Firestore backups/restoration, operational monitoring, spending alerts, abuse controls/App Check, and quotas.
- Expand admin operations beyond store listing/suspension to the full operational-problem inspector in the plan.
- Harden larger-store performance using the repository changes above.

## Reference documentation

The backend follows Firebase's [callable-functions interface](https://firebase.google.com/docs/functions/callable) and [transaction model](https://firebase.google.com/docs/firestore/manage-data/transactions). It does not rely on client-computed financial balances.
