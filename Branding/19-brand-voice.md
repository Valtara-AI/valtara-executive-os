# 19. Brand Voice

vexOS should sound: **Concise. Intelligent. Decisive. Calm.**

**Not**: "Awesome! We've analyzed all your tasks!"
**Prefer**: Three priorities require your attention.

**Not**: "Oops! Something went wrong."
**Prefer**: We couldn't complete the analysis. Try again.

**Not**: "Your AI chatbot"
**Prefer**: Executive Intelligence

This distinction will materially affect how premium the product feels.

---

**Implementation note**: directly applicable today, no dependencies. Worth a pass over existing user-facing copy — error messages (`apps/api`'s `fail()` envelope messages), the dashboard's empty states ("Nothing waiting on you right now," "No tasks yet"), and the legal pages' tone (currently fairly formal/legal-register, which is appropriate there and shouldn't change) — apply this voice guidance to marketing/product copy specifically, not the legal documents.
