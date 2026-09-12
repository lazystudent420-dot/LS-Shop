# Verification record

Date: 12 September 2026

| Check | Result |
| --- | --- |
| TypeScript check and production frontend build | Passed |
| Backend JavaScript syntax checks | Passed |
| Domain/business tests | 21 passed |
| Firestore rules emulator | Passed: customer isolation, owner isolation, private orders, hidden products, blocked balance and order writes |
| Transaction handler against Firestore Emulator | Passed: simultaneous checkout cannot oversell, repeated checkout returns one order, ownership is enforced |
| Rendered React UI test in JSDOM | Passed: add to basket, checkout, persistent order, owner acceptance, opening editor |
| Full Auth + Functions HTTP emulator integration | Attempted, blocked by environment EPERM on Functions emulator Unix socket |
| Visual browser inspection | Blocked: available browser could not open the local preview URL (ERR_BLOCKED_BY_CLIENT) |
| Production Firebase deployment | Not performed; no configured Firebase project supplied |
| Actual email delivery and Storage uploads | Not exercised; production services not configured |
| GitHub repository write | Not performed; connected account exposed no accessible repositories |

The JSDOM test exercises real rendered React controls and the device-local adapter. It does not verify pixel layout, responsive viewport appearance, native browser integration, or production authentication. The transaction test invokes the actual Firebase callable handler with test auth context, exercising its real Firestore transaction adapter without the blocked HTTP emulator transport.

The included CI workflow retains the full HTTP integration gate so it must pass in a normal runner before deployment. There are no claims of a deployed service or of completed production acceptance.

## Firebase configuration follow-up

The owner supplied the Web app settings for `ls-shop-59a3d` and target repository `lazystudent420-dot/LS-Shop`. The production configuration, project alias, and deployment instructions have been added. Frontend build, 21 domain tests, rendered UI test, and backend syntax checks were rerun. The prior record above describes the original delivery environment. No deployment authentication is included in the Web app settings.
