# VAREVANT Full Website

## Run
Open `index.html` directly in a browser, or serve the folder with any static server.

## Important production step
The consultation form currently uses a `mailto:` fallback to `evan@varevant.com`.
For reliable production submissions, connect it to Formspree, Resend, Netlify Forms, or a server-side endpoint.

## Assets
The project expects these files in `assets/`:
- varevant-monogram.png
- varevant-command-center.png
- varevant-workflow.png
- wellnesshub-command-center.png

If any uploaded source image was unavailable in the runtime, copy the original image into the matching asset filename.

## Changes in this pass (SEO + honesty pass)
- Added `robots.txt` and `sitemap.xml` — upload both to the domain root. Also add `Disallow: /` on the `varevant.netlify.app` staging deploy (Netlify site settings → add its own `robots.txt`, or set the site to `noindex` in Netlify's deploy settings) so it stops competing with the real domain in search and stops polluting Clarity data.
- Title/meta description/OG tags rewritten around actual target niches (HVAC, roofing, medspa) and regions (US, Australia) instead of generic "B2B/SME" language — matches what you're actually pitching.
- Added FAQPage JSON-LD (Google can show FAQ rich results) and tightened the ProfessionalService schema (`areaServed`, `knowsAbout`, correct `sameAs` links to LinkedIn/Instagram instead of just WhatsApp).
- Reframed "Selected Work" copy: instead of implying two separate paying clients (which isn't true yet), it now honestly frames both systems as ones you personally built and operate — proof of engineering capability without a false claim. Add real client case studies here the moment you land one; this section is designed to be swapped out.
- Added a short founder-note block above the consult form — a stand-in trust signal for a business with no testimonials yet.
- Next step for production: replace the `mailto:` form fallback with a real endpoint (Formspree/Resend/Netlify Forms) so submissions don't depend on the visitor's mail client actually opening — this is the biggest remaining conversion leak on desktop and especially mobile Safari.
- Also exclude your own dev/testing traffic from Clarity/GA4 (filter by IP or user ID) so your analytics stop being polluted by your own sessions.
