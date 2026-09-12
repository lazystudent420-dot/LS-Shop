# Deploy LS-Shop

The app is configured for Firebase project `ls-shop-59a3d`. The browser configuration supplied by the owner is in `.env.production`. It is not an administrative deployment credential.

## First deployment from your computer

1. In the Firebase project console, enable Authentication → Email/Password and Anonymous, create Firestore and Storage, and complete the project's required billing setup for Cloud Functions.
2. Clone this repository and open a terminal in its folder.
3. Run:

   ```sh
   npm ci
   npm ci --prefix functions
   npx firebase login
   npm run build
   npm --prefix functions run build
   npx firebase deploy --project ls-shop-59a3d
   ```

4. Open the Hosting URL printed by Firebase. Register an account, create your store, and add products. Production stores start empty.
5. Verify checkout, permissions, and uploads in the deployed environment before inviting customers. The Web app configuration does not demonstrate that these Firebase services are enabled.

## Automated deployments from GitHub

The workflow tests every main-branch change. Deployment stays disabled until the repository is connected to Google Cloud using Workload Identity Federation.

Configure these GitHub Actions repository variables:

- `GCP_WORKLOAD_IDENTITY_PROVIDER`: the configured Google Cloud federation provider resource name.
- `GCP_DEPLOY_SERVICE_ACCOUNT`: the deployment service account email with permissions restricted to the intended project.
- `ENABLE_FIREBASE_DEPLOY`: set to `true` after the connection is ready.

Restrict the Google Cloud trust configuration to this repository and its intended branch. Never paste account passwords or service-account JSON into chat or commit them to the repository.

## Email reminders

Real reminder email is disabled by default. Configure a verified sender and the `EMAIL_API_KEY` secret before enabling it. See README.md for the sender setup and remaining acceptance checks.
