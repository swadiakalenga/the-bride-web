# App Store Release Plan

App: TheBride  
Owner: GoldenGroup7 / Stephane Wa Diakalenga  
Last updated: 2026-05-20

---

## Overview

TheBride ships as three targets:
1. **Web app** — hosted on Vercel at `thebride.app`
2. **iOS app** — distributed via Apple App Store (`com.goldengroup7.thebride`)
3. **Android app** — distributed via Google Play Store (`com.goldengroup7.thebride`)

iOS and Android are built from the same Next.js codebase using **Capacitor**, which wraps the web app in a native shell.

---

## Current Capacitor Setup

- `capacitor.config.ts` is present in the project root.
- `android/` directory exists.
- `www/` directory (Capacitor web output) exists.
- Capacitor plugins to verify are installed:
  ```bash
  npx cap ls
  ```

Expected plugins:
```
@capacitor/core
@capacitor/app
@capacitor/camera          # photo capture
@capacitor/filesystem      # file access
@capacitor/haptics         # tap feedback
@capacitor/push-notifications   # Phase 1 — push (add when ready)
@capacitor/status-bar
@capacitor/splash-screen
```

Install any missing:
```bash
npm install @capacitor/haptics @capacitor/status-bar @capacitor/splash-screen
npx cap sync
```

---

## Capacitor Configuration

`capacitor.config.ts` should look like this:

```typescript
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.goldengroup7.thebride",
  appName: "TheBride",
  webDir: "out",          // Next.js static export output dir
  server: {
    // In development, point to local Next.js server for hot reload:
    // url: "http://192.168.X.X:3000",
    // androidScheme: "https",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: "#fffbeb",   // amber-50 — matches app background
      androidSplashResourceName: "splash",
      showSpinner: false,
    },
    StatusBar: {
      style: "light",
      backgroundColor: "#ffffff",
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
```

### Next.js static export

Capacitor requires a **static export** (no server-side rendering at build time). Add to `next.config.ts`:

```typescript
const nextConfig = {
  output: "export",           // generates the `out/` folder
  trailingSlash: true,        // required for Capacitor file routing
  images: {
    unoptimized: true,        // Next.js image optimisation requires a server
  },
};
```

> **Warning**: `output: "export"` disables API routes (`app/api/`) and server components. All existing pages that use `"use client"` already work. Pages with server-only logic will need to move to external API endpoints.

Build and sync:
```bash
npm run build          # generates out/
npx cap sync           # copies out/ to android/app/src/main/assets/public
```

---

## iOS Release Process

### Prerequisites
- macOS machine with Xcode 15+.
- Apple Developer account active (see `PRODUCTION_ACCOUNTS_SETUP.md`).
- Distribution certificate installed in Keychain.
- Provisioning profile (App Store distribution) installed.

### Step-by-step

1. **Build the web app:**
   ```bash
   npm run build
   npx cap sync ios
   ```

2. **Open in Xcode:**
   ```bash
   npx cap open ios
   ```

3. **In Xcode:**
   - Set **Team** to GoldenGroup7 in Signing & Capabilities.
   - Confirm **Bundle Identifier**: `com.goldengroup7.thebride`.
   - Set **Version** (e.g. `1.0.0`) and **Build** (e.g. `1`). Increment Build on every upload.
   - Set scheme to **Release**.
   - Destination: **Any iOS Device (arm64)**.

4. **Archive:**
   - **Product → Archive** — wait for the build to complete.
   - In the Organizer window → **Distribute App** → **App Store Connect**.
   - Upload to App Store Connect.

5. **In App Store Connect:**
   - Select the uploaded build.
   - Complete **What's New** (release notes).
   - Submit for **Review**.
   - Review typically takes 24–48 hours.

### Version naming convention
```
1.0.0 — initial launch
1.0.1 — bug fixes only
1.1.0 — new features (e.g. push notifications)
2.0.0 — major redesign or breaking change
```

### Xcode build settings to check
| Setting | Value |
|---------|-------|
| Deployment Target | iOS 16.0 (covers 95%+ of active devices) |
| Swift version | 5.9 |
| Enable Bitcode | No (deprecated in Xcode 14+) |
| Strip debug symbols | Yes (Release only) |

---

## Android Release Process

### Prerequisites
- Java 17+ installed (`java -version`).
- Android Studio installed (or Android SDK command-line tools).
- Upload keystore (`.jks`) available (see `PRODUCTION_ACCOUNTS_SETUP.md`).

### Step-by-step

1. **Build the web app:**
   ```bash
   npm run build
   npx cap sync android
   ```

2. **Open in Android Studio:**
   ```bash
   npx cap open android
   ```

3. **In Android Studio:**
   - Wait for Gradle sync to complete.
   - Verify `applicationId = "com.goldengroup7.thebride"` in `android/app/build.gradle`.
   - Set `versionCode` and `versionName`:
     ```gradle
     defaultConfig {
       versionCode 1          // increment by 1 on every upload
       versionName "1.0.0"    // human-readable version
     }
     ```

4. **Generate signed APK/AAB:**
   - **Build → Generate Signed Bundle / APK** → choose **Android App Bundle (.aab)**.
   - Select the upload keystore.
   - Build type: **release**.
   - Output: `android/app/release/app-release.aab`.

5. **Upload to Play Console:**
   - **Play Console → your app → Production → Create new release**.
   - Upload the `.aab` file.
   - Add release notes.
   - **Review release → Start rollout to Production**.
   - Play Store review takes 2–7 days for the first submission; updates take 1–3 days.

### Keystore safety
```
Store the .jks keystore in:
  1. A password-manager (1Password / Bitwarden) as a secure note with the file attached
  2. AWS Secrets Manager as a base64-encoded secret
  3. A secure USB drive locked away physically

DO NOT commit the .jks file to git.
Add to .gitignore:
  *.jks
  *.keystore
```

---

## App Store Listings

### Required assets for both stores

| Asset | Size | Notes |
|-------|------|-------|
| App icon | 1024×1024 PNG | No rounded corners — stores apply their own mask |
| Feature graphic (Play) | 1024×500 PNG | Displayed at top of Play Store listing |
| Screenshots — phone | 6.7" iPhone or equivalent | At least 3, up to 10 |
| Screenshots — tablet (optional) | iPad 12.9" | Recommended for Play Store |
| Short description | ≤80 chars | "A faith-based social platform for believers and churches" |
| Full description | ≤4000 chars | See draft below |

### Description draft

```
TheBride is a faith-based social network for believers and churches.

Connect with your congregation. Share your faith journey. Stay rooted in your spiritual community — wherever you are.

FEATURES:
• Post updates, photos, audio messages, and videos to your faith community
• Follow other believers and church admins
• Join your church, receive devotionals, and view upcoming events
• Share prayer requests and support others through Prayer Wall
• Give tithes and offerings directly through the app
• Watch live church services in real time
• Send direct messages to members of your congregation
• Get notified instantly when your community engages with you

FOR CHURCHES:
• Create a church profile with custom branding
• Share devotionals, events, and announcements to members
• Go live for Sunday services, Bible studies, and prayer meetings
• Review and approve membership requests
• Receive tithes and offerings from your congregation

TheBride is built for believers. Every feature is designed around community, worship, and growth.

Download TheBride and stay connected to your congregation.
```

### Content rating
- Google Play: select **Everyone** (no violence, no adult content, no gambling).
- Apple: select **4+** (no objectionable content).

### Privacy policy and terms
- Both stores **require** a Privacy Policy URL before submission.
- URL: `https://thebride.app/legal/privacy`
- Terms of Service URL: `https://thebride.app/legal/terms`

---

## Pre-submission Checklist

### Functionality (test on a real device, not simulator)

- [ ] App launches with correct splash screen
- [ ] Sign up with a new account
- [ ] Log in with an existing account
- [ ] Post a text post — appears in People feed
- [ ] Post with image — image uploads and displays
- [ ] Post with audio — audio plays inline
- [ ] Like, comment, reply, follow
- [ ] Open a church page, join, view devotionals and events
- [ ] Send a direct message — message delivers
- [ ] Open notifications — unread count correct
- [ ] Log out and log back in
- [ ] Offline state: graceful error shown (no white screen or crash)
- [ ] Rotate device — layout responds correctly

### iOS specific
- [ ] No crashes on iPhone 15 Pro (latest device)
- [ ] No crashes on iPhone SE 3rd gen (smallest supported screen)
- [ ] Status bar visible and correct colour
- [ ] Keyboard does not cover input fields
- [ ] Safe area insets respected (notch / Dynamic Island)
- [ ] App size < 200MB (App Store warning threshold)

### Android specific
- [ ] No crashes on Pixel 8 (latest Google device)
- [ ] No crashes on a budget Android device (e.g. Samsung A series)
- [ ] Back button / gesture behaves correctly
- [ ] Scoped storage permissions declared correctly in `AndroidManifest.xml`
- [ ] App targets Android 14 (API 34) — required by Play Store from 2024 onwards

### App Store guidelines compliance
- [ ] No external payment links that bypass Apple IAP for digital goods (if applicable)
- [ ] Camera/microphone usage descriptions in `Info.plist`
- [ ] All third-party SDKs declared in App Privacy Report (Xcode)
- [ ] No use of private/deprecated APIs (run `xcodebuild analyze`)

---

## Post-launch Monitoring

### Crash rates
- Set up **Sentry** for real-time crash alerts (see `PRODUCTION_ACCOUNTS_SETUP.md`).
- Target: crash-free sessions > 99.5%.
- Check App Store Connect → TestFlight → Crashes and Play Console → Android Vitals weekly.

### Review monitoring
- Check App Store Connect → Ratings and Reviews weekly.
- Reply to negative reviews within 48 hours.
- Log recurring complaints as GitHub issues.

### Update cadence
- Bug-fix releases: as needed (target < 24 hours from critical bug report to App Store submission).
- Feature releases: every 2–4 weeks.
- Always test the full pre-submission checklist before uploading a new build.

---

## TestFlight / Internal Testing (before public release)

### iOS — TestFlight
1. Upload a build to App Store Connect (same process as release but without submitting for review).
2. In **TestFlight** → **Internal Testing** → add testers (up to 100 Apple IDs).
3. Testers install **TestFlight** from the App Store → get an invite email → install TheBride.
4. Run the full pre-submission checklist with testers.
5. Minimum test period: **5 days** before submitting for App Store review.

### Android — Internal testing track
1. Upload the `.aab` to Play Console → **Internal testing** track.
2. Add tester email addresses.
3. Testers follow the opt-in link to install the test version.
4. Minimum test period: **3 days** before promoting to Production.

---

## Emergency Hotfix Process

If a critical bug is found after release:

1. Fix the bug on a `hotfix/` branch.
2. Run the full pre-submission checklist (minimum: affected flow only for speed).
3. Increment the Build number (iOS) / versionCode (Android).
4. Submit to App Store Connect with the note: "Critical bug fix — expedited review requested."
   - Apple offers **Expedited Review** for genuine emergencies. Use sparingly.
5. Play Store updates typically go live within 2–4 hours after approval (faster than iOS).
6. Post a note to users in the app via a banner if the bug significantly impacts usability.
