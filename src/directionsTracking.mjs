// Reuse the account's manual conversion action for a directions request only.
// Never send a conversion on a page load or build a remarketing audience.
const GOOGLE_TAG_ID = 'AW-10877264762';
const DIRECTIONS_CONVERSION = `${GOOGLE_TAG_ID}/2_IeCLi-1rADEPrG18Io`;

export function createDirectionsTracker(win, doc) {
  let initialized = false;
  let reported = false;

  const canMeasure = () =>
    ['1ag.tv', 'www.1ag.tv'].includes(win.location.hostname) &&
    win.location.hash === '#visit';

  function initialize() {
    if (!canMeasure()) return false;
    if (initialized) return true;
    try {
      win.dataLayer = win.dataLayer || [];
      win.gtag = win.gtag || function () { win.dataLayer.push(arguments); };
      win.gtag('set', 'allow_ad_personalization_signals', false);
      win.gtag('set', 'restricted_data_processing', true);
      win.gtag('js', new Date());
      // Do not send page URLs containing arbitrary queries or staff routes.
      const measuredUrl = new URL('https://1ag.tv/#visit');
      const incoming = new URLSearchParams(win.location.search || '');
      for (const key of ['gclid', 'gbraid', 'wbraid']) {
        const value = incoming.get(key);
        if (value) measuredUrl.searchParams.set(key, value);
      }
      win.gtag('config', GOOGLE_TAG_ID, {
        allow_ad_personalization_signals: false,
        restricted_data_processing: true,
        send_page_view: false,
        page_location: measuredUrl.href,
        page_referrer: '',
      });
      const script = doc.createElement('script');
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${GOOGLE_TAG_ID}`;
      doc.head.appendChild(script);
      initialized = true;
      return true;
    } catch {
      // Measurement must never prevent visitors from opening directions.
      return false;
    }
  }

  function track(event) {
    if (!event?.isTrusted || event.defaultPrevented || reported || !initialize()) return false;
    try {
      win.gtag('event', 'conversion', {
        send_to: DIRECTIONS_CONVERSION,
        allow_ad_personalization_signals: false,
        restricted_data_processing: true,
      });
      reported = true;
      return true;
    } catch {
      return false;
    }
  }

  return { initialize, track };
}

const tracker = typeof window === 'undefined' ? null : createDirectionsTracker(window, document);
export const initializeDirectionsTracking = () => tracker?.initialize();
export const trackVisitDirections = (event) => tracker?.track(event);
