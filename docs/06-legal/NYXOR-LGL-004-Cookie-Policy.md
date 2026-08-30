**VALTARA AI**

**Nyxor**

**COOKIE POLICY**

NYXOR-LGL-004 · Version 1.0 (Draft) · August 2026

| Document ID    | NYXOR-LGL-004                                                                                                                                                                                                                                                                                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Version        | 1.0 — **Draft, not yet published**                                                                                                                                                                                                                                                                                                                                 |
| Status         | **Requires qualified legal counsel review before publication.** Content reflects what the application actually sets today (confirmed against `apps/web` source, not assumed) — re-verified as of the Nyxor marketing landing page's launch (no new cookies, no analytics), and must be re-checked again whenever analytics or an advertising integration is added. |
| Owner          | Francis Ogbogu — Chief AI Officer, Valtara AI                                                                                                                                                                                                                                                                                                                      |
| Depends On     | NYXOR-LGL-002 (Privacy Policy)                                                                                                                                                                                                                                                                                                                                     |
| Classification | Public (once approved) — Draft is Confidential until then                                                                                                                                                                                                                                                                                                          |

---

## 1. What This Policy Covers

This policy explains the cookies and similar local-storage technologies that Nyxor ("**NYXOR**") uses across the application, including the public marketing pages (e.g. the Nyxor landing page at `/`) and when you sign in and use the product. The marketing pages set no cookies of their own beyond the same strictly necessary authentication cookies listed below - no analytics or tracking cookies are used anywhere on the site today.

## 2. Cookies We Use

NYXOR currently uses only **strictly necessary** cookies, set by our authentication system (NextAuth/Auth.js). We do not use advertising, marketing, or third-party analytics cookies of any kind.

| Cookie                                                                 | Purpose                                                                                                     | Type               | Duration                            |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------ | ----------------------------------- |
| `authjs.session-token` (or `__Secure-authjs.session-token` over HTTPS) | Keeps you signed in; identifies your authenticated session and role (Executive, Delegate, or Administrator) | Strictly necessary | Session, up to 8 hours idle timeout |
| `authjs.csrf-token`                                                    | Protects the sign-in flow against cross-site request forgery                                                | Strictly necessary | Session                             |
| `authjs.callback-url`                                                  | Returns you to the page you were trying to reach after signing in                                           | Strictly necessary | Session                             |

Because these cookies are strictly necessary for NYXOR to function — you cannot use a HITL-governed AI product without being securely authenticated — they are not subject to opt-out consent under PIPEDA, GDPR, or CCPA, all of which exempt cookies necessary to provide a service the user has requested.

## 3. Local Storage (Not a Cookie, But Similar)

NYXOR stores your light/dark theme preference in your browser's local storage (key `nyxor-theme`). This never leaves your browser, is not transmitted to our servers, and contains no personal information beyond your display preference.

## 4. Third-Party Cookies

When you connect an integration (Google, Microsoft, Slack, PandaDoc), you are briefly redirected to that provider's own consent screen, which may set its own cookies under its own domain and policy. NYXOR has no access to and does not control those cookies — see the relevant provider's own cookie/privacy policy.

## 5. Managing Cookies

Because NYXOR's cookies are strictly necessary for sign-in, blocking them in your browser will prevent you from using the Service. You can still clear cookies at any time through your browser settings, which will simply sign you out.

## 6. Changes to This Policy

If NYXOR later adds analytics or any non-essential cookie, this policy will be updated first and a consent mechanism will be added before any such cookie is set — nothing beyond the strictly-necessary cookies above is used today, including on the marketing pages.

## 7. Contact

Questions about this policy: Francis Ogbogu, Chief AI Officer — fcogbogu@gmail.com.

---

_NYXOR-LGL-004 · Version 1.0 (Draft) · August 2026 · Not yet approved for publication_
