// SRS §7 / SEC-001 §4: "Security headers | HSTS, X-Content-Type-Options,
// X-Frame-Options, Referrer-Policy, Permissions-Policy set on all
// responses." Hono's built-in secureHeaders() already turns on HSTS,
// X-Content-Type-Options, X-Frame-Options, and Referrer-Policy by default
// - only permissionsPolicy needs an explicit value here, since its default
// is an empty object (no header emitted). This is a JSON API with no
// browser-rendered surface of its own, so every listed feature is denied
// outright rather than scoped to "self".

import { secureHeaders } from "hono/secure-headers";

export const securityHeaders = secureHeaders({
  permissionsPolicy: {
    camera: [],
    microphone: [],
    geolocation: [],
    payment: [],
    usb: [],
  },
});
