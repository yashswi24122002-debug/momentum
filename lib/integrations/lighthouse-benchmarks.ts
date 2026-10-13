// Google's own published "good practice" for the most common Lighthouse
// audits, keyed by the audit's own id (not its title, which can vary
// slightly in wording) — used to give the "Full Technical Findings"
// table a real comparison value instead of just the raw check name.
// Deliberately not exhaustive (Lighthouse has ~150 audits); anything
// missing here falls back to a neutral generic statement rather than an
// invented specific number.
export const LIGHTHOUSE_BENCHMARKS: Record<string, string> = {
  // Performance — numeric thresholds
  "largest-contentful-paint": "Under 2.5 seconds",
  "first-contentful-paint": "Under 1.8 seconds",
  "speed-index": "Under 3.4 seconds",
  "total-blocking-time": "Under 200 milliseconds",
  "cumulative-layout-shift": "Under 0.1",
  interactive: "Under 3.8 seconds",
  "max-potential-fid": "Under 130 milliseconds",
  "server-response-time": "Under 600 milliseconds",

  // Performance — pass/fail style
  "uses-text-compression": "Text-based files are compressed",
  "uses-responsive-images": "Images sized to match their display size",
  "uses-optimized-images": "Images compressed efficiently",
  "offscreen-images": "Off-screen images loaded only when needed",
  "render-blocking-resources": "Nothing blocks the page from starting to render",
  "unused-css-rules": "No large amount of unused CSS",
  "unused-javascript": "No large amount of unused JavaScript",
  "uses-long-cache-ttl": "Static files cached for a long time on repeat visits",
  "dom-size": "A reasonably sized page structure",
  "third-party-summary": "Minimal slowdown from third-party scripts",

  // SEO
  "meta-description": "A meta description is present",
  "document-title": "A descriptive page title is present",
  "link-text": "Links describe where they lead",
  "is-crawlable": "Page is not blocked from search engines",
  canonical: "A valid canonical URL is set",
  "font-size": "Text is legible (12px or larger)",
  "tap-targets": "Buttons/links sized and spaced for easy tapping",
  hreflang: "Valid language targeting set up",

  // Accessibility
  "image-alt": "All images have descriptive alt text",
  "color-contrast": "Text has enough contrast against its background",
  label: "Form fields have an associated label",
  "link-name": "Links have a clear, readable name",
  "heading-order": "Headings are in a logical order",
  "html-has-lang": "Page declares its language",
  "frame-title": "Frames have a descriptive title",
  "aria-hidden-focus": "Hidden elements aren't still reachable by keyboard",
  "duplicate-id-active": "No duplicate element IDs",
  "meta-viewport": "Visitors can still zoom the page",

  // Best practices
  "is-on-https": "All resources loaded securely (HTTPS)",
  "no-vulnerable-libraries": "No JavaScript libraries with known security issues",
  charset: "Character encoding declared correctly",
  doctype: "A valid HTML doctype is declared",
  "geolocation-on-start": "No location permission requested without the visitor asking",
  "notification-on-start": "No notification permission requested without the visitor asking",
  deprecations: "No use of browser features marked for removal",
  "errors-in-console": "No errors logged in the browser console",
  "image-aspect-ratio": "Images displayed at their correct proportions",
  "image-size-responsive": "Images sized correctly for the screen showing them",
};

export const DEFAULT_LIGHTHOUSE_BENCHMARK = "Should pass Google's recommended practice for this check";
