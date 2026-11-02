# Subs App — Design Amendment to Plan 2

**Applies to:** `docs/superpowers/plans/2026-11-02-subs-app.md`, Tasks 5–15.
**Source of truth for visuals:** the approved design canvas, "Clear Ledger" (https://claude.ai/artifact/BDNQiQ1DNfDu4yrViaNVHg). It is copied into the repo as HTML mockups at `docs/design/canvas/*.dc.html`; open a file to read its exact colors, sizes and copy.
**Rule:** where this amendment and the plan disagree, this amendment wins. Where it says nothing, the plan stands: its data hooks, tests, i18n rules, layering and acceptance checks all still apply. Each task keeps its own tests and adds tests for the new behavior listed here.

## 1. Design tokens (Task 5 adds them; every later task uses them)

`app/tailwind.config.js` `theme.extend`:

```js
colors: {
  ground: { DEFAULT: '#F5F6F8', dark: '#0E1013' },
  surface: { DEFAULT: '#FFFFFF', dark: '#171A1F' },
  surface2: { DEFAULT: '#EEF0F3', dark: '#20242B' },
  line: { DEFAULT: '#E3E6EA', dark: '#2A2F37' },
  ink: { DEFAULT: '#14171C', dark: '#F1F3F5' },
  muted: { DEFAULT: '#5B6370', dark: '#9AA3AF' },
  accent: { DEFAULT: '#0B7A57', dark: '#34C08E', soft: '#E2F3EB', 'soft-dark': '#12382A', strong: '#075A40' },
  warn: { DEFAULT: '#9A4A06', soft: '#FDF1DD', ink: '#5A2E04' },
  danger: { DEFAULT: '#B42F25' },
  badge: { DEFAULT: '#D9342B' },
  cat: { 1: '#0B7A57', 2: '#2F6FDB', 3: '#E39B2B', 4: '#7A5AE0', 5: '#D2497A', rest: '#9AA3AF' },
},
fontFamily: {
  display: ['Manrope_800ExtraBold'],
  heading: ['Manrope_700Bold'],
  sans: ['Inter_400Regular'],
  medium: ['Inter_500Medium'],
  semibold: ['Inter_600SemiBold'],
  bold: ['Inter_700Bold'],
},
borderRadius: { card: '20px', tile: '16px' },
```

- **Pairing:** every surface or text color is written as a light/dark pair, for example `bg-surface dark:bg-surface-dark` and `text-ink dark:text-ink-dark`. Screens should mostly get these through the UI kit components.
- **Raw values:** never use raw hex or `neutral-*` / `blue-*` classes in screens. Tokens only.
- **Font weight:** in React Native, weight comes from the font *family*. Use `font-semibold` (the Inter_600SemiBold family above), not CSS `font-weight`.
- **Tabular numbers:** money and dates use `style={{ fontVariant: ['tabular-nums'] }}` (`AppText` prop `numeric`).

**Fonts.** Run `npx expo install expo-font @expo-google-fonts/manrope @expo-google-fonts/inter`. The root layout (Task 6) loads `Manrope_700Bold`, `Manrope_800ExtraBold`, `Inter_400Regular`, `Inter_500Medium`, `Inter_600SemiBold` and `Inter_700Bold` with `useFonts`, and keeps the splash screen up until both the fonts and the session are ready. Jest needs no font mock beyond what jest-expo provides; if it does, add a minimal `expo-font` mock to `jest.setup.ts`.

## 2. UI kit changes (Task 5)

Restyle the plan's components to the design-system sheet (`docs/design/canvas/Main.dc.html`):

- **Button:**
  - All variants: `h-12 rounded-xl`, label `font-semibold text-base`.
  - Variants:
    - primary: `bg-accent`, white label (dark mode `bg-accent-dark`, label `text-ground-dark`).
    - secondary: `bg-surface border border-line`.
    - danger: `bg-danger`.
    - new `ghost`: transparent background, accent label.
  - Disabled: 45% opacity.
- **TextField:** label `text-[13px] font-medium text-muted`. Input `h-12 rounded-xl border border-line bg-surface px-3.5 text-base`. Error state: 1.5px `border-danger` with the message in `text-danger`.
- **SegmentedChoice** (sort and filter chips): pill chips, `h-9 rounded-full px-3.5`. Selected `bg-ink` with white text; unselected `bg-surface border border-line`.
- **New `SegmentedControl`:** an equal-width group on `bg-surface2 rounded-[14px] p-1`. The selected item is `bg-surface` with a subtle shadow. Used for Weekly/Monthly/Yearly and My default/Custom. `accessibilityRole="radio"` per item.
- **New `SwitchRow`:** label, an optional description line, and a React Native `Switch` tinted accent. The switch gets `accessibilityLabel` = the label. Minimum height 48.
- **New `ProgressSteps`:** `count` and `current` props. Renders equal 4px bars, accent up to `current` and `line` after.
- **New `ServiceIcon`:** props `service: { name: string; logo_url: string | null; color?: string | null }` and `size`.
  - Rounded square with radius = 0.3 × size.
  - If `logo_url` is set: `expo-image` fills the tile (`npx expo install expo-image`).
  - Otherwise: a letter tile showing the first letter of the name in `font-display`. The background is `service.color`, or else a palette color picked by a stable hash of the name from `cat.1`–`cat.5`. The letter is white.
  - Test both branches.
- **Card:** `bg-surface rounded-card p-4`. The section `heading` text is `font-heading text-[17px]`.
- **ListRow:** stays, and gains a `leading` slot for `ServiceIcon` or date tiles.
- **Banner:** warning uses `bg-warn-soft` with `text-warn-ink` and a leading warning icon. Info uses `bg-accent-soft`.

Icons: `@expo/vector-icons` Ionicons (already installed). Match the canvas glyphs as closely as Ionicons allows.

## 3. Screen and flow changes

### Task 6: onboarding, register and login (canvas: `Onboarding1–4`, `Register`, `Login`)

- **New route `(auth)/welcome`** (screen `OnboardingScreen`): 4 slides with the canvas copy, illustration blocks built from UI kit pieces, step dots, Next, Back (slides 2–4) and Skip (jumps to slide 4).
  - Slide 4 has "Get started", which goes to `/register`, and "I already have an account", which goes to `/login`.
  - Use one screen with an index in state (or a paging `FlatList`). Both are fine; tests drive the Next and Skip buttons.
- **First-run routing:** signed-out users see `/welcome` until they reach slide 4 or tap either final button. That sets pref `onboarding.seen` = `'1'`, and after that the auth stack's first screen is `/login`. Add `'onboarding.seen'` to `PrefKey`.
  - `prefs.clear()` (run on sign-out) must keep `onboarding.seen`. Change it to skip that key, and test it.
- **Register:** name, email and password with a show/hide toggle (`accessibilityLabel` "Show password").
  - The password hint "At least 8 characters" sits under the field.
  - A summary row reads "Totals shown in" plus `EUR · Europe/Berlin`, with a **Change** button that opens the currency `SelectField`. The timezone stays device-detected and only changes in Settings.
  - After a successful register: `router.replace('/subscriptions/new')`, because the first subscription is next.
- **Login:** matches the canvas (logo tile, headline "Know what you pay for.", fields, Forgot password, "No account yet? Create one").

### Task 7: dashboard (canvas: `Dashboard`, `DashboardDark`)

- **Header:** title, plus the bell as a 44×44 `bg-surface` tile with a red count badge.
- **Hero card:** `bg-accent rounded-[24px]` showing "You spend per month", the monthly total in `font-display text-[44px]` white, then two translucent pills: yearly total and "{{count}} active".
- **"By category" card:** `SpendChart` becomes one stacked horizontal bar (12px, 2px gaps, segments colored `cat.1…5`, `cat.rest` for the rest) plus legend rows: color dot, label, monthly amount, percent. It keeps its props and its accessibility labels.
- **"Next 30 days":** a "See all" link to the Subscriptions tab, then rows with a date tile (month abbreviation above the day number) and a relative subtitle ("Tomorrow", "In 7 days"). Add i18n plural keys for these.
- **Unverified email banner and unconverted warning:** both stay, styled as `Banner`.

### Task 8: subscriptions list (canvas: `Subscriptions`)

- **Header:** an accent "+" tile button labelled "Add subscription", which goes to `/subscriptions/new`.
- **Filters:** sort chips, then two `SelectField`-style filter buttons side by side ("All statuses", "All categories").
- **Rows:** `ServiceIcon` (40), name, "{{category}} · Next {{date}}", and on the right the amount with the period below it. Paused or cancelled rows are dimmed (opacity 0.72) with a `warn-soft` status pill.

### Task 10: add-subscription flow (canvas: `NewSub1`, `NewSubCustom`, `NewSub2`, `NewSub3`, `NewSub3Custom`)

This replaces the plan's single scrolling form. The route is still `/subscriptions/new`, presented as a modal. One screen holds the step in state, so data survives Back. It has `ProgressSteps` (3), a header with Back (steps 2–3) and Close, and a sticky primary footer button on steps 2–3.

1. **Step 1, "What are you paying for?":**
   - A search field. Typing debounces into `useServiceSearch`, and results show as rows with `ServiceIcon`.
   - With an empty query, a **Popular** 3-column grid shows the first 9 catalog services (`is_custom === false`) from `useServiceSearch('')`.
   - Tapping a service selects it and goes **straight to step 2**.
   - A dashed button "Not listed? Add your own service" (also shown as a row "Add “{{query}}” as your own service" when the search has no exact match) opens **step 1b**.
2. **Step 1b, "Add your own service":**
   - A preview tile, a Name field (prefilled from the query), and "Upload an image" through `expo-image-picker`. Run `npx expo install expo-image-picker` and add its config plugin with a photo-library permission string.
   - The picker uses square crop with `allowsEditing: true, aspect: [1, 1]`, quality 0.8.
   - Six color swatches (`cat.1`, `#2F5BD3`, `#6D4ED8`, `#C23A6E`, `#C2410C`, `#3A414B`) for the letter tile, plus the note "Private to your account…".
   - Continue: `POST /services { name, color }`, then, if an image was picked, `POST /services/{id}/logo` as multipart form data. Add `servicesApi.uploadLogo(id, uri)` using `FormData` with `{ uri, name: 'logo.jpg', type: 'image/jpeg' }`. The API client needs a multipart path: when `body` is a `FormData`, skip JSON encoding and the Content-Type header.
   - A failed upload keeps the service and shows the error. The user can continue with the letter tile.
   - Then go to step 2 with the new service selected.
3. **Step 2, "How much is it?":**
   - A service chip row with Change, which goes back to step 1.
   - A large amount input (`font-display text-[44px]`, with the currency symbol to its left) and a currency chip that opens the currency `SelectField`.
   - **Billed:** a `SegmentedControl` (Weekly/Monthly/Yearly) and a "Billed every few months?" ghost link that reveals an "Every N" numeric field (`interval_count`, default 1).
   - **Next payment:** chips Today / Tomorrow / a date chip. The date chip opens a `YYYY-MM-DD` text field in a modal, per plan ruling 2. The value is sent as `first_payment_date`, which works because `BillingCycle` anchors on any date.
   - **Category row:** auto-filled from the service default, with Change opening the category `SelectField`.
   - "+ Add a note" reveals a notes field.
   - Validation reuses the plan's `subscriptionFormSchema`. Show field errors inline. The "Saved as …" preview is no longer needed, because the big amount displays formatted on blur.
4. **Step 3, "Remind you before it renews?":**
   - A summary line (service · amount period · next date).
   - A **Remind me** `SwitchRow`, which maps to `reminders_enabled`.
   - When on, a `SegmentedControl` **My default | Custom**:
     - **My default** shows a read-only When / At / How summary of `useReminderDefaults()`, plus the hint "Your default lives in Settings › Reminders…".
     - **Custom** shows the new `ReminderEditor` (below), seeded from the defaults.
   - A first-reminder preview line ("You'll first be reminded on {{date}} at {{time}}.") computed client-side from the next payment date and the earliest rule.
   - **Save subscription:** `POST /subscriptions` with `reminders_enabled`. If Custom, then `PUT /subscriptions/{id}/reminders`. Then the existing push-offer logic: `/push-intro`, else `router.back()`.

**`ReminderEditor`** replaces the plan's `ReminderRulesEditor`. It keeps `validateRules`, `MAX_RULES` and `RuleSummary`. Each rule shows:
- **When:** chips On the day / 1 day / 3 days / 7 days / Other…, where Other reveals a numeric field from 0 to 60.
- **At:** a time button showing `HH:MM`, which opens a text field in a modal validated by the existing regex.
- **How:** three `SwitchRow`s, Push notification, In-app inbox and Email. The Email row shows the account email as its description.
- Below the rules, a "+ Add another reminder" ghost button (up to `MAX_RULES`). Each extra rule has a Remove button.

### Task 11: subscription detail (canvas: `SubscriptionDetail`)

- **Header:** `ServiceIcon` (56), name and "{{category}} · {{status}}".
- **Amount card:** the price in `font-display`, the per-year line, and a 2-column Next payment / First payment grid. Notes go in their own card.
- **Reminders section:** a **Remind me** `SwitchRow` (PATCH `reminders_enabled`). When on, the default or custom summary with Customize / Use default reminders, editing in `ReminderEditor`.
- **Actions:** Edit (dark `bg-ink` button), Pause / Resume and Mark as cancelled side by side, and Delete subscription as a ghost danger button with the plan's second-tap confirm.
- **Edit:** reuses steps 2–3 of the add flow, pre-filled, in an "edit" mode of the same component.

### Task 13: inbox (canvas: `Inbox`)

- Unread items are `bg-surface` cards with an accent dot and a bold title. Read items are transparent cards with a `line` border.
- "Mark all as read" is a ghost button in the header.

### Task 14: settings (canvas: `Settings`, `DefaultReminders`)

- **Grouped sections**, each with an uppercase caption: **Reminders** first, then Profile, Account, and a Danger zone.
- **Reminders:** a "Default reminders" row (bell tile, summary subtitle, chevron) that goes to the new route **`settings/reminders`** (`DefaultRemindersScreen`: title, explanation, `ReminderEditor`, Save). Below it, a SwitchRow "Push notifications on this device", the plan's push toggle.
- **Profile:** rows for Name, Main currency, Language and Timezone, each showing its value on the right and opening its editor (name in a modal `TextField`, the others in `SelectField`; the device-timezone button stays inside the timezone editor).
- **Account:** the email with a Verified pill, or the verify banner. Manage categories. Log out.
- **Danger zone:** the plan's password-confirmed delete.

## 4. API types and client (folded into the first task that needs them)

- `Subscription` gains `reminders_enabled: boolean`, and its `service` object gains `color: string | null`.
- `Service` gains `color: string | null`.
- `SubscriptionPayload` gains `reminders_enabled?: boolean`.
- New endpoints, live once the backend change lands: `PATCH /services/{id}` (`name`, `color`), `POST /services/{id}/logo` (multipart `logo`), `DELETE /services/{id}/logo`.
- `api()` multipart support: if `body instanceof FormData`, pass it through as-is with no `Content-Type` header. Test it.

## 5. Fixtures and tests

Update `src/test/fixtures.ts` for the new fields. Every new component and flow above gets RNTL tests in the plan's style. At minimum:
- onboarding: Next, Skip and the final buttons set `onboarding.seen`;
- register goes to `/subscriptions/new`;
- the add flow:
  - picking a popular tile jumps to step 2;
  - the own-service path posts the service, then the logo;
  - the reminders-off save sends `reminders_enabled: false`;
  - the Custom save sends PUT reminders;
- the detail screen's reminder switch PATCHes the flag;
- `settings/reminders` saves the defaults;
- `ServiceIcon` covers both the logo and the letter branch.
