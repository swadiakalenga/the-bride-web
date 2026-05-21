# Supabase Email OTP — Setup Guide

TheBride supports passwordless login via a 6-digit email code.  
This document explains what needs to be configured in the Supabase dashboard.

---

## 1 — Enable Email OTP in Authentication settings

1. Go to **Supabase Dashboard → Authentication → Providers → Email**
2. Make sure **"Enable Email provider"** is ON
3. Under **"Confirm email"**, keep it enabled (OTP works whether or not email confirmation is required)
4. Save changes

---

## 2 — Customize the OTP email template

> **This step is required.** Without it, Supabase sends a magic link (clickable URL) instead of a 6-digit code. The app will show a warning to the user until this is configured.

1. Go to **Authentication → Email Templates**
2. Select the **"Magic Link"** template (Supabase uses this template for both magic links and OTP codes)
3. Change the subject line:

```
Your TheBride login code
```

4. Replace the entire body with the code-only template below.  
   **Use `{{ .Token }}` — not `{{ .ConfirmationURL }}`.**  
   `{{ .ConfirmationURL }}` produces a clickable link; `{{ .Token }}` produces the 6-digit number.

```html
<h2>Your TheBride login code</h2>
<p>Enter this code to sign in to your TheBride account:</p>
<h1 style="letter-spacing: 8px; font-size: 40px; font-weight: bold; font-family: monospace;">{{ .Token }}</h1>
<p>This code expires in <strong>10 minutes</strong>.</p>
<p>If you did not request this code, you can safely ignore this email.</p>
```

5. Click **Save**.

### What happens if the template is NOT updated

- Supabase sends an email with a clickable link instead of a 6-digit code.
- The user sees a number input on-screen expecting a code, but receives a link in their inbox.
- The login page shows an amber warning: *"If you received a link instead of a 6-digit code, the Supabase email template needs updating."*
- Fix: update the template as described above, then re-send the code.

> **Summary of the critical difference:**
> - `{{ .Token }}` → 6-digit number (e.g. `847293`) — what the app expects
> - `{{ .ConfirmationURL }}` → clickable URL — used for magic link flows only

---

## 3 — Rate limiting

Supabase applies built-in rate limiting on OTP sends per email address.  
The frontend also enforces a **60-second cooldown** between resend attempts.

To adjust server-side rate limits: **Authentication → Rate Limits → Email OTP**.

---

## 4 — How the frontend calls Supabase

### Send OTP

```typescript
const { error } = await supabase.auth.signInWithOtp({
  email: email.trim(),
  options: {
    shouldCreateUser: false,  // IMPORTANT: do not auto-register unknown emails
  },
});
```

- If the email does not exist in `auth.users`, Supabase returns an error — the login page shows "No account found for this email."
- If the email exists, Supabase sends the 6-digit code.

### Verify OTP

```typescript
const { error } = await supabase.auth.verifyOtp({
  email: email.trim(),
  token: code.trim(),
  type: "email",
});
```

- On success: Supabase sets the session and the user is logged in.
- On failure: error.message explains the reason (expired, invalid code, etc.).

---

## 5 — Sequence diagram

```
User enters email
      │
      ▼
signInWithOtp({ email, shouldCreateUser: false })
      │
      ├── email not in auth.users → Error: "No account found"
      │
      └── email found → Supabase sends 6-digit code via email
                              │
                              ▼
                    User enters 6-digit code
                              │
                              ▼
                   verifyOtp({ email, token, type: "email" })
                              │
                              ├── invalid/expired → Error shown to user
                              │
                              └── success → session created → redirect to /feed
```

---

## 6 — Testing

1. Create a test account via the normal register flow.
2. On the login page, choose **"Sign in with code"** tab.
3. Enter the registered email → click **Send code**.
4. Check Supabase Dashboard → Authentication → Logs to see the OTP email (or check the actual inbox).
5. Enter the 6-digit code → should redirect to `/feed`.

Test invalid code: enter `000000` → should show "Invalid or expired code."

---

## 7 — Production checklist

- [ ] Custom SMTP configured (Authentication → SMTP Settings) — avoids Supabase's 3/hour free limit
- [ ] Email template updated with `{{ .Token }}`
- [ ] `shouldCreateUser: false` confirmed in signInWithOtp call
- [ ] Rate limiting reviewed for expected traffic
- [ ] Test with real email provider (not just Supabase inbucket)
