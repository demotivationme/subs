# Sign in with Google and Apple — design

Date: 2026-11-03 · Status: approved in conversation, awaiting spec review · Branch: `dev`

## Goal

Let people create a Subs account and sign in with Google or Apple, alongside the existing email and
password, on iOS, Android and web. A first sign-in creates a verified account; a returning one signs
straight in; an email that already has a password account is linked to it automatically.

Sign in with Apple ships in the same work because App Store guideline 4.8 requires it whenever an app
offers another third-party login.

## Decisions

| Topic | Decision |
|---|---|
| Providers | Google and Apple |
| Approach | The app gets an **ID token** from the native (or web) Google/Apple sheet and posts it to the API; the API verifies it and issues the usual Sanctum token. No browser redirects, no Socialite, no hosted auth service. |
| Existing email | **Link automatically** when the provider says the email is verified, then sign in. |
| Buttons per platform | iPhone: Apple + Google · Android: Google · Web: Google + Apple |
| App identifier | `com.alterwave.subs` (iOS bundle ID and Android package; already in `app/app.json`) |
| Testing before the paid Apple account | Google on web and the Android emulator; a free-signing iPhone development build for Google; Apple waits for the account. Automated tests cover both. |
| Expo Go | Neither button shows (the Google SDK is not in Expo Go; Apple tokens there are issued to Expo Go's bundle ID). |

## User experience

- **Start, Login and Register** show "Continue with Apple" (Apple's own black/white button, as Apple
  requires) and "Continue with Google", then an "or" divider, then the existing email form.
- **First sign-in** creates the account with `email_verified_at` set (no confirmation email), locale,
  currency and timezone from the device exactly as registration does today, and the default
  categories. Apple's name, sent only on the very first authorisation, is saved then; otherwise the
  name is the email's local part, as for any account without one.
- **After sign-in** the app goes where email login goes today (onboarding, push intro or Home).
- **Cancelling** the sheet does nothing. **A failure** shows the usual inline error under the
  buttons. The pressed button shows a spinner while waiting.
- **Accounts without a password** cannot use email login until they set one through "Forgot
  password", which already works for any verified email. After that both methods work.
- **Deleting an account** today requires the current password. An account without a password
  instead confirms by typing `DELETE`. The API exposes `has_password` on `/me` so Settings shows the
  right confirmation.
- **Apple "Hide My Email"** gives a `…@privaterelay.appleid.com` address. It never matches an
  existing account, so it always creates a new one. Reminder emails reach it once the sending domain
  is registered with Apple's private email relay (a setup step, not code).

## Backend

### Database (one migration)

- New table `social_accounts`: `id`, `user_id` (FK, cascade on delete), `provider` (`google` |
  `apple`), `provider_user_id` (the token's `sub`), `email` (nullable, as last seen),
  `apple_refresh_token` (nullable, encrypted cast), timestamps.
  Unique on (`provider`, `provider_user_id`); unique on (`user_id`, `provider`).
- `users.password` becomes nullable.

### Endpoint

`POST /api/v1/auth/social` — public, `throttle:auth`, same response as `POST /auth/login`.

Body:

| Field | Rules |
|---|---|
| `provider` | required, `google` or `apple` |
| `id_token` | required string |
| `nonce` | required when `provider` is `apple`; the raw nonce whose SHA-256 the token carries |
| `authorization_code` | optional, Apple only; exchanged for the refresh token used to revoke on deletion |
| `name` | optional string ≤ 255, Apple's first-authorisation name |
| `locale`, `currency`, `timezone` | the same rules as `POST /auth/register` |

Layering follows the rest of the API: `SocialLoginRequest` → `SocialLoginInput` DTO →
`SocialAuthService` → `SocialAccountRepository` / `UserRepository`. Only repositories query.

### Verifying the ID token

`IdentityTokenVerifier` interface with `GoogleTokenVerifier` and `AppleTokenVerifier`, built on
`firebase/php-jwt`:

- signature against the provider's JWKS (Google `https://www.googleapis.com/oauth2/v3/certs`, Apple
  `https://appleid.apple.com/auth/keys`), cached for an hour, refetched once on an unknown `kid`
- `iss`: Google `accounts.google.com` or `https://accounts.google.com`; Apple
  `https://appleid.apple.com`
- `aud` is one of the configured client IDs for that provider
- `exp` in the future (60 s leeway)
- `email` present and `email_verified` true (Apple sends it as a string or a boolean)
- Apple: `nonce` claim equals `sha256(raw nonce)` in hex

It returns a `VerifiedIdentity` (provider, subject, email) or throws.

### Finding or creating the user (one transaction)

1. `social_accounts` has (provider, subject) → that user; update its stored email.
2. Else a user with that email (lowercased) exists → link a new `social_accounts` row; set
   `email_verified_at` if it was empty.
3. Else create the user (no password, verified email, device locale/currency/timezone, default
   categories, as registration does) and link the row.

The unique index makes a concurrent double sign-in fail safely; the service retries the lookup once
on a unique violation, so both requests end up signed in to the same account.

### Apple token revocation

- On an Apple sign-in carrying `authorization_code`, the API exchanges it at
  `https://appleid.apple.com/auth/token` for a refresh token, using a client secret JWT (ES256) signed
  with the `.p8` key, and stores it encrypted on the `social_accounts` row. A failed exchange is
  logged and does not block sign-in.
- Account deletion dispatches a queued `RevokeAppleTokens` job (3 tries, backoff) that posts each
  stored token to `https://appleid.apple.com/auth/revoke`. Deletion never waits for it.
- Without `APPLE_TEAM_ID`/`APPLE_KEY_ID`/`APPLE_PRIVATE_KEY` configured, exchange and revocation are
  skipped with a log line.

### Changes to existing behaviour

- `AuthService::login` treats a user with no password like a wrong password (same message, so the
  response does not reveal how the account was made).
- `DeleteAccountRequest`: `password` is required only when the user has one; otherwise `confirm`
  must equal `DELETE`.
- `UserResource` adds `has_password` (bool).

### Config (`backend/.env`, entered by the user)

```
GOOGLE_CLIENT_IDS=<web id>,<ios id>,<android id>
APPLE_CLIENT_IDS=com.alterwave.subs,<services id for web>
APPLE_TEAM_ID=
APPLE_KEY_ID=
APPLE_PRIVATE_KEY=        # the .p8 contents, or a path to it
```

Read through `config/services.php` (`services.google`, `services.apple`).

### Errors

| Case | Response |
|---|---|
| Bad signature, wrong `iss`/`aud`, expired, nonce mismatch, unverified email | 422 on `id_token`: "We couldn't verify your sign-in. Please try again." |
| JWKS unreachable | 503 "Sign-in is temporarily unavailable. Please try again." |
| Validation (missing fields) | the usual 422 |

### Backend tests (Pest)

A test RSA key pair signs tokens; `Http::fake` serves its JWKS for both providers.

- new Google user → account created, verified, token returned, default categories present
- returning user (same `sub`) → same account, no duplicate
- existing password account with the same email → linked, both methods work afterwards
- email not verified → 422; wrong `aud`, wrong `iss`, expired, tampered signature → 422
- Apple: nonce mismatch → 422; first-authorisation `name` saved; `authorization_code` exchanged and
  stored encrypted (Apple token endpoint faked)
- JWKS endpoint down → 503
- password login for a no-password account → the usual wrong-credentials error
- deleting a no-password account with `confirm=DELETE` works; without it → 422
- deleting an account with Apple tokens queues revocation; the job posts to Apple's revoke endpoint
- the layering arch tests still pass

## App

### Sign-in modules (`src/auth/social/`)

One file per platform, like `src/push/`:

| | Native | Web |
|---|---|---|
| Google | `@react-native-google-signin/google-signin` (config plugin, `iosUrlScheme`) | Google Identity Services script, rendered button, returns the credential |
| Apple | `expo-apple-authentication` (iOS only; `ios.usesAppleSignIn` via config) | Sign in with Apple JS, popup mode |

Each returns the same `SocialCredential` (`provider`, `idToken`, and for Apple `nonce`,
`authorizationCode`, `name`) or a `cancelled` result. Apple's nonce is generated with `expo-crypto`;
the SHA-256 goes to Apple, the raw value to the API.

`useSocialLogin()` posts to `/auth/social` and then does exactly what email login does with the
token (`useSession.signIn`, then the same next-screen logic).

### `SocialButtons`

Shown on Start, Login and Register. A button appears only when it can work: Google when its client ID
is configured, Apple when `isAvailableAsync()` is true on iOS or its Services ID is configured on web;
neither inside Expo Go (`Constants.executionEnvironment === 'storeClient'`). Spinner on the pressed
button, silence on cancel, inline `ErrorMessage` on failure.

### Settings

The delete-account form asks for the password when `has_password` is true, otherwise for typing
`DELETE`.

### Config

- `app.json` becomes `app.config.ts` so plugins can read environment variables.
- `app/.env` (public IDs, not secrets): `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`,
  `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, `EXPO_PUBLIC_APPLE_SERVICES_ID`,
  `EXPO_PUBLIC_APPLE_REDIRECT_URI`.
- `FREE_SIGNING=1` builds without the push entitlement and without Sign in with Apple, so
  `FREE_SIGNING=1 npx expo run:ios --device` can be signed by a free Apple ID personal team.

### App tests (Jest/RNTL, sign-in libraries mocked)

- which buttons show per platform, with missing config, and in Expo Go
- success stores the token and moves on like email login
- cancel shows nothing; an API error is shown inline
- Apple: the hashed nonce goes to Apple, the raw nonce to the API
- Settings delete form: password field vs typing `DELETE`

## Documentation

A README section with step-by-step console setup:

- **Google Cloud:** OAuth consent screen; client IDs for web (authorised origin
  `http://localhost:8081` and the production domain), iOS (bundle `com.alterwave.subs`) and Android
  (package `com.alterwave.subs` plus the signing key's SHA-1).
- **Apple Developer:** enable Sign in with Apple on the `com.alterwave.subs` App ID; a Services ID
  with the web domain and return URL; a Sign in with Apple key (`.p8`); register the reminder sender
  domain with the private email relay.
- Which value goes in `app/.env` and which in `backend/.env`.

## Out of scope

- Linking or unlinking providers from Settings, and showing which provider an account uses.
- Apple sign-in on Android.
- Server-to-server notifications from Apple (account deleted or email changed on Apple's side).
