import { useState, useEffect, useRef } from "react";
import './supabase'; // Initialize Supabase storage
import { uploadStaffPhoto, supabase } from './supabase';


// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// BRAND CONSTANTS
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const BLUE = "#01A8D7";
const DARK = "#212120";
const ADMIN_PASS = import.meta.env.VITE_ADMIN_PASS || "1agchurch";
const STORAGE_KEY = "1ag_sermons_v1";
const STAFF_KEY = "1ag_staff_v1";
const SETTINGS_KEY = "1ag_settings_v1";

const DEFAULT_SETTINGS = {
  churchName: "1AG Church",
  address: "500 Cross Ave, Jerseyville, IL 62052",
  phone: "618.498.9597",
  email: "info@1ag.tv",
  sundayTime: "10:00 AM",
  youthTime: "5:00 PM",
  givingUrl: "https://give.tithe.ly/?formId=da3a50fa-4392-4b56-8970-a97759f2e4e4",
  watchLiveUrl: "https://1agchurch.online.church",
  calendarId: "info@1ag.tv",
  calendarKey: "AIzaSyDJqSm1c2UbhG2JsMMa7QZrz5r8hyiGe1g",
  facebookUrl: "",
  instagramUrl: "",
  youtubeUrl: "",
};

const DEFAULT_STAFF = [
  {
    id: "st1",
    name: "Pastor [Your Name]",
    title: "Lead Pastor",
    bio: "Update this bio in the Staff Manager.",
    photoUrl: "",
    order: 0,
  },
];
// Giving URL is now managed via Settings admin panel (settings.givingUrl)
// Logo image path — place 1AG_Color_Web.png in the same folder as this file
const LOGO_SRC = "./1AG_Color_Web.png";

const DEFAULT_SERMONS = [];

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// GLOBAL STYLES
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const globalStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@100;200;300;400;500;600;700;800;900&display=swap');
  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body { font-family: 'Outfit', sans-serif; background: #fff; color: ${DARK}; -webkit-font-smoothing: antialiased; }
  input, textarea, select, button { font-family: 'Outfit', sans-serif; }
  input::placeholder, textarea::placeholder { color: #aaa; }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: #f1f1f1; }
  ::-webkit-scrollbar-thumb { background: ${BLUE}; border-radius: 3px; }

  @keyframes heroFloat {
    0%, 100% { transform: translateY(0px) scale(1); opacity: 0.6; }
    50% { transform: translateY(-20px) scale(1.05); opacity: 0.9; }
  }
  @keyframes heroFloat2 {
    0%, 100% { transform: translateY(0px) scale(1.05); opacity: 0.4; }
    50% { transform: translateY(20px) scale(1); opacity: 0.7; }
  }
  @keyframes scrollBounce {
    0%, 100% { transform: translateX(-50%) translateY(0); opacity: 1; }
    50% { transform: translateX(-50%) translateY(10px); opacity: 0.5; }
  }
  @keyframes fadeSlideUp {
    from { opacity: 0; transform: translateY(24px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  @keyframes pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.08); }
  }
  @keyframes livePulse {
    0% { transform: scale(1); opacity: 0.8; }
    50% { transform: scale(2.4); opacity: 0; }
    100% { transform: scale(1); opacity: 0; }
  }

  .hero-orb-1 { animation: heroFloat 7s ease-in-out infinite; }
  .hero-orb-2 { animation: heroFloat2 9s ease-in-out infinite; }
  .hero-orb-3 { animation: heroFloat 11s ease-in-out infinite reverse; }
  .scroll-bounce { animation: scrollBounce 2.2s ease-in-out infinite; }

  .nav-link {
    color: rgba(255,255,255,0.75);
    font-family: 'Outfit', sans-serif;
    font-weight: 500;
    font-size: 15px;
    cursor: pointer;
    text-decoration: none;
    letter-spacing: 0.3px;
    padding-bottom: 3px;
    border-bottom: 2px solid transparent;
    transition: color 0.2s, border-color 0.2s;
  }
  .nav-link:hover { color: white; }
  .nav-link.active { color: white; border-bottom-color: ${BLUE}; font-weight: 700; }

  .sermon-card {
    background: white;
    border-radius: 10px;
    overflow: hidden;
    box-shadow: 0 2px 16px rgba(0,0,0,0.06);
    cursor: pointer;
    transition: transform 0.22s ease, box-shadow 0.22s ease;
  }
  .sermon-card:hover {
    transform: translateY(-6px);
    box-shadow: 0 12px 40px rgba(1,168,215,0.15);
  }

  .pill-btn {
    display: inline-flex;
    align-items: center;
    padding: 8px 20px;
    border-radius: 100px;
    border: 2px solid #e0e0e0;
    background: white;
    color: #555;
    font-family: 'Outfit', sans-serif;
    font-weight: 500;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.18s ease;
  }
  .pill-btn:hover { border-color: ${BLUE}; color: ${BLUE}; }
  .pill-btn.active {
    background: ${BLUE};
    border-color: ${BLUE};
    color: white;
    font-weight: 700;
  }

  .stat-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 22px 0;
    border-bottom: 1px solid rgba(255,255,255,0.1);
  }
  .stat-row:last-child { border-bottom: none; }

  .btn-primary {
    background: ${BLUE};
    color: white;
    border: none;
    border-radius: 5px;
    padding: 14px 32px;
    font-family: 'Outfit', sans-serif;
    font-weight: 700;
    font-size: 14px;
    letter-spacing: 1px;
    text-transform: uppercase;
    cursor: pointer;
    transition: background 0.2s, transform 0.15s;
  }
  .btn-primary:hover { background: #0193ba; transform: translateY(-1px); }

  .btn-ghost {
    background: transparent;
    color: white;
    border: 2px solid rgba(255,255,255,0.4);
    border-radius: 5px;
    padding: 14px 32px;
    font-family: 'Outfit', sans-serif;
    font-weight: 600;
    font-size: 14px;
    letter-spacing: 1px;
    text-transform: uppercase;
    cursor: pointer;
    transition: border-color 0.2s, background 0.2s;
  }
  .btn-ghost:hover { border-color: white; background: rgba(255,255,255,0.08); }

  .input-field {
    width: 100%;
    padding: 13px 16px;
    border: 2px solid #e5e5e5;
    border-radius: 6px;
    font-family: 'Outfit', sans-serif;
    font-size: 15px;
    color: ${DARK};
    background: white;
    outline: none;
    transition: border-color 0.2s;
    box-sizing: border-box;
  }
  .input-field:focus { border-color: ${BLUE}; }
  .input-field.error { border-color: #e55; }

  .label-text {
    display: block;
    font-family: 'Outfit', sans-serif;
    font-weight: 700;
    font-size: 12px;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: ${DARK};
    margin-bottom: 8px;
  }

  .modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 9000;
    background: rgba(33,33,32,0.88);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    backdrop-filter: blur(4px);
  }

  .section-tag {
    color: ${BLUE};
    font-family: 'Outfit', sans-serif;
    font-weight: 700;
    font-size: 12px;
    letter-spacing: 4px;
    text-transform: uppercase;
    margin-bottom: 16px;
  }

  .page-header {
    background: linear-gradient(135deg, ${DARK} 0%, #1a2a35 100%);
    padding: 100px 40px 80px;
    text-align: center;
  }

  .footer-link {
    font-family: 'Outfit', sans-serif;
    color: rgba(255,255,255,0.5);
    font-size: 15px;
    cursor: pointer;
    display: block;
    margin-bottom: 12px;
    transition: color 0.2s;
  }
  .footer-link:hover { color: ${BLUE}; }

  @media (max-width: 768px) {
    .desktop-nav { display: none !important; }
    .mobile-hamburger { display: flex !important; }
    .hero-h1 { font-size: 56px !important; }
    .grid-2 { grid-template-columns: 1fr !important; }
    .grid-3 { grid-template-columns: 1fr !important; }
    .page-header { padding: 80px 24px 60px !important; }
    .content-pad { padding: 48px 24px !important; }
    .stat-grid { grid-template-columns: 1fr 1fr !important; }
    .admin-form-grid { grid-template-columns: 1fr !important; }
  }
`;

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// LOGO — uses official 1AG Church PNG
// Place 1AG_Color_Web.png in the same directory as this file.
// mix-blend-mode:screen makes the black background transparent
// when the logo sits on a dark-colored surface.
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function Logo({ variant = "nav", size = "md" }) {
  const heights = { sm: 36, md: 44, lg: 60 };
  const h = heights[size] || 44;
  const onDark = variant !== "light-bg";
  return (
    <img
      src={LOGO_SRC}
      alt="1AG Church"
      draggable={false}
      style={{
        height: h,
        width: "auto",
        display: "block",
        cursor: "pointer",
        // Screen blend makes the black PNG background vanish on dark surfaces
        mixBlendMode: onDark ? "screen" : "normal",
        filter: onDark ? "brightness(1.08) contrast(1.05)" : "none",
        objectFit: "contain",
        userSelect: "none",
      }}
    />
  );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// NAVBAR
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function Navbar({ page, navigate, isAdminLoggedIn, settings }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isHome = page === "home";

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const solid = !isHome || scrolled || mobileOpen;

  const links = [
    { label: "Home", href: "home" },
    { label: "About", href: "about" },
    { label: "Sermons", href: "sermons" },
    { label: "Events", href: "calendar" },
    { label: "Plan Your Visit", href: "visit" },
  ];

  return (
    <>
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000,
        background: solid ? DARK : "transparent",
        borderBottom: solid ? "1px solid rgba(255,255,255,0.08)" : "none",
        transition: "background 0.35s ease, border 0.35s ease",
      }}>
        <div style={{
          maxWidth: 1200, margin: "0 auto",
          padding: "0 40px",
          height: 72,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div onClick={() => navigate("home")} style={{ lineHeight: 0 }}>
            <Logo variant="nav" size="md" />
          </div>

          {/* Desktop */}
          <div className="desktop-nav" style={{ display: "flex", alignItems: "center", gap: 32 }}>
            {links.map(l => (
              <span
                key={l.href}
                className={`nav-link ${page === l.href ? "active" : ""}`}
                onClick={() => navigate(l.href)}
              >{l.label}</span>
            ))}
            {/* Give button — accent gold-on-blue stands out from primary actions */}
            <a
              href={settings.givingUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                background: "transparent",
                border: `2px solid ${BLUE}`,
                color: BLUE,
                borderRadius: 5,
                padding: "9px 20px",
                fontFamily: "'Outfit', sans-serif",
                fontWeight: 700, fontSize: 13,
                letterSpacing: "1px", textTransform: "uppercase",
                textDecoration: "none",
                cursor: "pointer",
                transition: "background 0.2s, color 0.2s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = BLUE; e.currentTarget.style.color = "white"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = BLUE; }}
            >
              <svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 18s-7-4.686-7-10a7 7 0 0 1 14 0c0 5.314-7 10-7 10z" />
              </svg>
              Give
            </a>
            <button
              className="btn-primary"
              style={{ padding: "10px 20px", fontSize: 12 }}
              onClick={() => navigate("admin")}
            >
              {isAdminLoggedIn ? "Admin" : "Staff Login"}
            </button>
          </div>

          {/* Mobile hamburger */}
          <button
            className="mobile-hamburger"
            onClick={() => setMobileOpen(p => !p)}
            style={{
              display: "none",
              background: "none", border: "none", cursor: "pointer",
              flexDirection: "column", gap: 5, padding: 4,
            }}
            aria-label="Menu"
          >
            {[0, 1, 2].map(i => (
              <span key={i} style={{ display: "block", width: 24, height: 2, background: "white", borderRadius: 2 }} />
            ))}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div style={{
            background: DARK, padding: "16px 40px 24px",
            borderTop: "1px solid rgba(255,255,255,0.08)",
          }}>
            {[
              ...links,
              { label: "Give", href: "give-external" },
              { label: isAdminLoggedIn ? "Admin Dashboard" : "Staff Login", href: "admin" }
            ].map(l => (
              <div
                key={l.href}
                onClick={() => {
                  if (l.href === "give-external") { window.open(settings.givingUrl, "_blank"); }
                  else navigate(l.href);
                  setMobileOpen(false);
                }}
                style={{
                  padding: "14px 0",
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                  color: l.href === "give-external" ? BLUE : page === l.href ? BLUE : "rgba(255,255,255,0.8)",
                  fontFamily: "'Outfit', sans-serif",
                  fontWeight: l.href === "give-external" || page === l.href ? 700 : 400,
                  fontSize: 16, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 8,
                }}
              >
                {l.href === "give-external" && (
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 18s-7-4.686-7-10a7 7 0 0 1 14 0c0 5.314-7 10-7 10z" />
                  </svg>
                )}
                {l.label}
              </div>
            ))}
          </div>
        )}
      </nav>
    </>
  );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// FOOTER
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function Footer({ navigate, settings }) {
  return (
    <footer style={{ background: DARK, paddingTop: 72, paddingBottom: 36 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 40px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 48, marginBottom: 56 }}
          className="grid-2">
          <div>
            <div style={{ lineHeight: 0 }}>
              <Logo variant="footer" size="md" />
            </div>
            <p style={{
              fontFamily: "'Outfit', sans-serif",
              color: "rgba(255,255,255,0.45)",
              fontSize: 15, lineHeight: 1.9,
              marginTop: 20, maxWidth: 300,
            }}>
              One church. All generations. Building faith, community, and purpose together — every single day.
            </p>
            <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
              {[
                { key: "facebook", label: "f", url: settings.facebookUrl },
                { key: "instagram", label: "ig", url: settings.instagramUrl },
                { key: "youtube", label: "▶", url: settings.youtubeUrl },
              ].map(({ key, label, url }) => {
                const Tag = url ? "a" : "div";
                return (
                  <Tag
                    key={key}
                    {...(url ? { href: url, target: "_blank", rel: "noreferrer" } : {})}
                    style={{
                      width: 38, height: 38, borderRadius: "50%",
                      background: "rgba(255,255,255,0.08)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: url ? "pointer" : "default",
                      transition: "background 0.2s",
                      textDecoration: "none",
                    }}
                  >
                    <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>{label}</span>
                  </Tag>
                );
              })}
            </div>
          </div>
          <div>
            <p style={{ color: BLUE, fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: "2.5px", textTransform: "uppercase", marginBottom: 20 }}>
              Navigate
            </p>
            {[{ l: "Home", h: "home" }, { l: "About", h: "about" }, { l: "Sermons", h: "sermons" }, { l: "Events", h: "calendar" }, { l: "Plan Your Visit", h: "visit" }].map(i => (
              <span key={i.h} className="footer-link" onClick={() => navigate(i.h)}>{i.l}</span>
            ))}
            {/* Giving link */}
            <a
              href={settings.givingUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                fontFamily: "'Outfit', sans-serif",
                color: BLUE,
                fontSize: 15,
                cursor: "pointer",
                display: "flex", alignItems: "center", gap: 7,
                marginBottom: 12,
                fontWeight: 700,
                textDecoration: "none",
                transition: "opacity 0.2s",
              }}
            >
              <svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 18s-7-4.686-7-10a7 7 0 0 1 14 0c0 5.314-7 10-7 10z" />
              </svg>
              Give Online
            </a>
          </div>
          <div>
            <p style={{ color: BLUE, fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: "2.5px", textTransform: "uppercase", marginBottom: 20 }}>
              Service Times
            </p>
            {[`Sunday ${settings.sundayTime}`, `Sunday ${settings.youthTime} — Youth`].map(t => (
              <p key={t} style={{ color: "rgba(255,255,255,0.45)", fontSize: 15, marginBottom: 10, fontFamily: "'Outfit', sans-serif" }}>{t}</p>
            ))}
          </div>
          <div>
            <p style={{ color: BLUE, fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: "2.5px", textTransform: "uppercase", marginBottom: 20 }}>
              Contact
            </p>
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 15, lineHeight: 2.0, fontFamily: "'Outfit', sans-serif" }}>
              {settings.address}<br />
              {settings.email}<br />
              {settings.phone}
            </p>
          </div>
        </div>
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 28, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <p style={{ fontFamily: "'Outfit', sans-serif", color: "rgba(255,255,255,0.25)", fontSize: 13 }}>
            © {new Date().getFullYear()} 1AG Church. All rights reserved.
          </p>
          <p style={{ fontFamily: "'Outfit', sans-serif", color: "rgba(255,255,255,0.25)", fontSize: 13 }}>
            Designed with purpose for the Kingdom
          </p>
        </div>
      </div>
    </footer>
  );
}

// ——————————————————————————————————————————————————————————————————————————
// UPCOMING EVENTS FEED
// Uses Google Calendar public JSON feed.
// Setup: paste your Calendar ID into GOOGLE_CAL_ID below,
// and create a free API key at console.cloud.google.com
// (enable the "Google Calendar API", restrict to your domain).
// ——————————————————————————————————————————————————————————————————————————
// GCAL_ID and GCAL_KEY are now managed via Settings admin panel (settings.calendarId / settings.calendarKey)

// Sample events shown while the calendar is not yet connected
const SAMPLE_EVENTS = [
  { id: 1, summary: "Sunday Morning Service", start: "2025-02-16T10:00:00", location: "500 Cross Ave, Jerseyville" },
  { id: 2, summary: "Youth Group", start: "2025-02-16T17:00:00", location: "500 Cross Ave, Jerseyville" },
  { id: 3, summary: "Leadership Team Meeting", start: "2025-02-18T18:00:00", location: "Church Office" },
  { id: 4, summary: "Sunday Morning Service", start: "2025-02-23T10:00:00", location: "500 Cross Ave, Jerseyville" },
  { id: 5, summary: "Youth Group", start: "2025-02-23T17:00:00", location: "500 Cross Ave, Jerseyville" },
  { id: 6, summary: "Community Outreach Day", start: "2025-03-01T09:00:00", location: "Jerseyville Community" },
];

function UpcomingEvents({ navigate, settings }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [usingReal, setUsingReal] = useState(false);

  useEffect(() => {
    const calId = settings?.calendarId || "";
    const calKey = settings?.calendarKey || "";
    const isConfigured = calId.length > 0 && calKey.length > 0 && !calId.includes("YOUR_") && !calKey.includes("YOUR_");

    if (isConfigured) {
      const now = new Date().toISOString();
      const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events?key=${calKey}&timeMin=${now}&maxResults=6&singleEvents=true&orderBy=startTime`;
      fetch(url)
        .then(r => r.json())
        .then(data => {
          if (data.items && data.items.length) {
            setEvents(data.items);
            setUsingReal(true);
          } else {
            setEvents(SAMPLE_EVENTS);
          }
        })
        .catch(() => setEvents(SAMPLE_EVENTS))
        .finally(() => setLoading(false));
    } else {
      setTimeout(() => {
        setEvents(SAMPLE_EVENTS);
        setLoading(false);
      }, 400);
    }
  }, [settings?.calendarId, settings?.calendarKey]);

  const fmt = (dateStr) => {
    const d = new Date(dateStr);
    return {
      month: d.toLocaleString("en-US", { month: "short" }).toUpperCase(),
      day: d.getDate(),
      dow: d.toLocaleString("en-US", { weekday: "long" }),
      time: d.toLocaleString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
    };
  };

  // Group events by month/day for visual separation
  const grouped = events.reduce((acc, ev) => {
    const startStr = ev.start?.dateTime || ev.start?.date || ev.start;
    const d = new Date(startStr);
    const key = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    if (!acc[key]) acc[key] = [];
    acc[key].push({ ...ev, _startStr: startStr });
    return acc;
  }, {});

  return (
    <section style={{ padding: "88px 40px", background: "white" }} className="content-pad">
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 48, flexWrap: "wrap", gap: 16 }}>
          <div>
            <p className="section-tag">What's Coming Up</p>
            <h2 style={{
              fontFamily: "'Outfit', sans-serif", fontWeight: 900,
              fontSize: "clamp(30px, 4.5vw, 48px)",
              color: DARK, lineHeight: 1.05, letterSpacing: "-1px",
            }}>
              Upcoming Events
            </h2>
          </div>
          <button
            className="btn-primary"
            style={{ fontSize: 12, flexShrink: 0 }}
            onClick={() => navigate("calendar")}
          >
            Full Calendar →
          </button>
        </div>

        {/* Setup notice — only shown when not configured */}
        {!usingReal && (
          <div style={{
            background: `${BLUE}0d`,
            border: `1px solid ${BLUE}30`,
            borderLeft: `4px solid ${BLUE}`,
            borderRadius: 8, padding: "14px 20px",
            display: "flex", gap: 12, alignItems: "center",
            marginBottom: 36,
          }}>
            <svg width="16" height="16" viewBox="0 0 20 20" fill={BLUE}><circle cx="10" cy="10" r="9" stroke={BLUE} strokeWidth="1.5" fill="none" /><path d="M10 9v5M10 7h.01" stroke={BLUE} strokeWidth="1.8" strokeLinecap="round" /></svg>
            <p style={{ fontFamily: "'Outfit', sans-serif", color: "#4a6070", fontSize: 13, lineHeight: 1.6 }}>
              <strong>Sample events shown.</strong> To connect your Google Calendar, go to the Admin panel → ⚙️ Settings and enter your Calendar ID and Google API Key.
            </p>
          </div>
        )}

        {/* Events */}
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
            <div style={{ width: 36, height: 36, border: `3px solid ${BLUE}33`, borderTopColor: BLUE, borderRadius: "50%", animation: "spin 0.9s linear infinite" }} />
          </div>
        ) : (
          <div>
            {Object.entries(grouped).map(([month, monthEvents]) => (
              <div key={month} style={{ marginBottom: 40 }}>
                {/* Month label */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 16, marginBottom: 20,
                }}>
                  <span style={{
                    fontFamily: "'Outfit', sans-serif", fontWeight: 900,
                    fontSize: 13, letterSpacing: "3px", textTransform: "uppercase",
                    color: BLUE,
                  }}>{month}</span>
                  <div style={{ flex: 1, height: 1, background: "#eef0f3" }} />
                </div>

                {/* Event cards */}
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {monthEvents.map((ev, i) => {
                    const f = fmt(ev._startStr || ev.start);
                    const isAllDay = !(ev.start?.dateTime || (typeof ev.start === "string" && ev.start.includes("T")));
                    return (
                      <div
                        key={ev.id || i}
                        style={{
                          display: "flex", alignItems: "center", gap: 0,
                          background: "#F8FAFB",
                          borderRadius: 12,
                          overflow: "hidden",
                          border: "1px solid #eef0f3",
                          transition: "box-shadow 0.2s, transform 0.2s",
                          cursor: "default",
                        }}
                        onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 6px 28px ${BLUE}18`; e.currentTarget.style.transform = "translateY(-2px)"; }}
                        onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "translateY(0)"; }}
                      >
                        {/* Date block */}
                        <div style={{
                          background: BLUE,
                          width: 80, flexShrink: 0,
                          display: "flex", flexDirection: "column",
                          alignItems: "center", justifyContent: "center",
                          padding: "20px 12px",
                          alignSelf: "stretch",
                        }}>
                          <span style={{
                            fontFamily: "'Outfit', sans-serif",
                            fontWeight: 700, fontSize: 10,
                            color: "rgba(255,255,255,0.75)",
                            letterSpacing: "2px", textTransform: "uppercase",
                            marginBottom: 4,
                          }}>{f.month}</span>
                          <span style={{
                            fontFamily: "'Outfit', sans-serif",
                            fontWeight: 900, fontSize: 34,
                            color: "white", lineHeight: 1,
                          }}>{f.day}</span>
                        </div>

                        {/* Event info */}
                        <div style={{ flex: 1, padding: "18px 24px" }}>
                          <p style={{
                            fontFamily: "'Outfit', sans-serif",
                            fontWeight: 800, fontSize: 16,
                            color: DARK, marginBottom: 5, lineHeight: 1.3,
                          }}>
                            {ev.summary || ev.label}
                          </p>
                          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                            {!isAllDay && (
                              <span style={{
                                display: "inline-flex", alignItems: "center", gap: 5,
                                fontFamily: "'Outfit', sans-serif",
                                fontSize: 13, color: "#6b7280",
                              }}>
                                <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                  <circle cx="10" cy="10" r="8" /><path d="M10 6v4l2.5 2.5" />
                                </svg>
                                {f.time}
                              </span>
                            )}
                            {(ev.location) && (
                              <span style={{
                                display: "inline-flex", alignItems: "center", gap: 5,
                                fontFamily: "'Outfit', sans-serif",
                                fontSize: 13, color: "#6b7280",
                              }}>
                                <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                  <path d="M10 18s-7-4.686-7-10a7 7 0 0 1 14 0c0 5.314-7 10-7 10z" /><circle cx="10" cy="8" r="2" />
                                </svg>
                                {ev.location}
                              </span>
                            )}
                            {ev.description && (
                              <span style={{
                                fontFamily: "'Outfit', sans-serif",
                                fontSize: 13, color: "#94a3b8",
                                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 260,
                              }}>
                                {ev.description.replace(/<[^>]*>/g, "").slice(0, 80)}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Day of week badge */}
                        <div style={{
                          padding: "0 24px",
                          flexShrink: 0,
                          textAlign: "right",
                        }}>
                          <span style={{
                            fontFamily: "'Outfit', sans-serif",
                            fontWeight: 700, fontSize: 11,
                            color: "#c8d0d8", letterSpacing: "1.5px",
                            textTransform: "uppercase",
                          }}>{f.dow}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Bottom link */}
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <button
            onClick={() => navigate("calendar")}
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontFamily: "'Outfit', sans-serif",
              fontWeight: 700, fontSize: 14,
              color: BLUE, letterSpacing: "0.5px",
              textDecoration: "underline", textUnderlineOffset: 3,
            }}
          >
            See everything on the calendar →
          </button>
        </div>

      </div>
    </section>
  );
}

// ——————————————————————————————————————————————————————————————————————————
// HOME PAGE
// ——————————————————————————————————————————————————————————————————————————
function HomePage({ sermons, navigate, settings }) {
  const latest = sermons.length > 0
    ? [...sermons].sort((a, b) => new Date(b.date) - new Date(a.date))[0]
    : null;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div>
      {/* ——— VIDEO HERO ——— */}
      <section style={{
        position: "relative",
        height: "100vh", minHeight: 640,
        overflow: "hidden",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: DARK,
      }}>
        {/* Video Background */}
        <video
          autoPlay
          muted
          loop
          playsInline
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
          src="/hero_video2.mp4"
        />
        {/* Dark overlay so text is readable */}
        <div style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0, 0, 0, 0.4)",
        }} />
        {/* Hero Content */}
        <div style={{
          position: "relative", zIndex: 2,
          textAlign: "center", padding: "0 24px",
          maxWidth: 820,
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(20px)",
          transition: "opacity 0.9s ease, transform 0.9s ease",
        }}>
          <p style={{
            fontFamily: "'Outfit', sans-serif",
            color: BLUE, fontSize: 16,
            fontWeight: 700, letterSpacing: "5px",
            textTransform: "uppercase", marginBottom: 24,
          }}>
            1AG CHURCH
          </p>
          <h1
            className="hero-h1"
            style={{
              fontFamily: "'Outfit', sans-serif",
              color: "white",
              fontSize: "clamp(60px, 10vw, 108px)",
              fontWeight: 900,
              lineHeight: 1.0,
              letterSpacing: "-3px",
              marginBottom: 32,
            }}
          >
            Welcome<br />
            <span style={{
              color: BLUE,
              WebkitTextStroke: "0px",
            }}>Home.</span>
          </h1>
          <p style={{
            fontFamily: "'Outfit', sans-serif",
            color: "rgba(255,255,255,0.65)",
            fontSize: "clamp(16px, 2.5vw, 20px)",
            fontWeight: 300,
            lineHeight: 1.75,
            marginBottom: 48,
            maxWidth: 580, margin: "0 auto 48px",
          }}>
            Everyday people learning to follow Jesus together —<br />
            rooted in community, growing in faith, alive in purpose.
          </p>
          <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
            {/* Watch Live */}
            <a
              href={settings.watchLiveUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "inline-flex", alignItems: "center", gap: 10,
                background: BLUE,
                color: "white",
                borderRadius: 5, padding: "14px 32px",
                fontFamily: "'Outfit', sans-serif",
                fontWeight: 800, fontSize: 14,
                letterSpacing: "1px", textTransform: "uppercase",
                textDecoration: "none",
                cursor: "pointer",
                boxShadow: `0 8px 28px ${BLUE}55`,
                transition: "background 0.2s, transform 0.15s",
                border: "none",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "#0193ba"; e.currentTarget.style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = BLUE; e.currentTarget.style.transform = "translateY(0)"; }}
            >
              <span style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", width: 10, height: 10 }}>
                <span style={{
                  position: "absolute",
                  width: 10, height: 10, borderRadius: "50%",
                  background: "#ff3b3b",
                  animation: "livePulse 1.8s ease-in-out infinite",
                }} />
                <span style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: "#ff3b3b",
                  position: "relative", zIndex: 1,
                }} />
              </span>
              Watch Live
            </a>

            {/* Plan Your Visit */}
            <button className="btn-primary" style={{ background: "rgba(255,255,255,0.15)", border: "2px solid rgba(255,255,255,0.5)", backdropFilter: "blur(4px)" }} onClick={() => navigate("visit")}>
              Plan Your Visit
            </button>
          </div>
        </div>

        {/* Scroll indicator */}
        <div
          className="scroll-bounce"
          style={{
            position: "absolute", bottom: 32,
            left: "50%",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
            color: "rgba(255,255,255,0.35)",
            fontFamily: "'Outfit', sans-serif",
            fontSize: 10, letterSpacing: "3px",
          }}
        >
          <span>SCROLL</span>
          <svg width="14" height="20" viewBox="0 0 14 20" fill="none">
            <path d="M7 1v14M1 10l6 7 6-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </section>

      {/* ——— LATEST SERMON ——— */}
      {latest && (
        <section style={{ padding: "80px 40px", background: "#F5F7FA" }} className="content-pad">
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 40, flexWrap: "wrap", gap: 16 }}>
              <div>
                <p className="section-tag">Fresh From The Pulpit</p>
                <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "clamp(28px, 4vw, 42px)", color: DARK }}>
                  Latest Message
                </h2>
              </div>
              <button className="btn-primary" style={{ fontSize: 12 }} onClick={() => navigate("sermons")}>
                View All Sermons →
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 48, alignItems: "center" }} className="grid-2">
              <div style={{
                borderRadius: 10, overflow: "hidden",
                aspectRatio: "16/9",
                boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
              }}>
                <iframe
                  src={`https://www.youtube.com/embed/${latest.youtubeId}`}
                  title={latest.title}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  style={{ width: "100%", height: "100%", display: "block" }}
                />
              </div>
              <div>
                <p style={{ color: BLUE, fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "2.5px", textTransform: "uppercase", marginBottom: 14 }}>
                  {latest.series}
                </p>
                <h3 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 28, color: DARK, lineHeight: 1.25, marginBottom: 16 }}>
                  {latest.title}
                </h3>
                <p style={{ fontFamily: "'Outfit', sans-serif", color: "#5a6370", fontSize: 16, lineHeight: 1.8, marginBottom: 24 }}>
                  {latest.description}
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 32 }}>
                  <p style={{ fontFamily: "'Outfit', sans-serif", color: "#888", fontSize: 14 }}>
                    Speaker: <strong style={{ color: DARK }}>{latest.speaker}</strong>
                  </p>
                  <p style={{ fontFamily: "'Outfit', sans-serif", color: "#aaa", fontSize: 13 }}>
                    {new Date(latest.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                  </p>
                </div>
                <button className="btn-primary" onClick={() => navigate("sermons")}>
                  More Messages
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ——— UPCOMING EVENTS FEED ——— */}
      <UpcomingEvents navigate={navigate} settings={settings} />

      {/* ——— SERVICE TIMES ——— */}
      <section style={{ padding: "80px 40px", background: "white" }} className="content-pad">
        <div style={{ maxWidth: 1100, margin: "0 auto", textAlign: "center", marginBottom: 56 }}>
          <p className="section-tag">Join Us</p>
          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "clamp(32px, 5vw, 52px)", color: DARK }}>
            Service Times
          </h2>
        </div>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 24 }} className="grid-2">
          {[
            { day: "Sunday Morning", time: settings.sundayTime, label: "Sunday Service", accent: BLUE },
            { day: "Sunday Night", time: settings.youthTime, label: "Youth Group", accent: DARK },
          ].map(s => (
            <div key={s.day} style={{
              borderRadius: 12, padding: "36px 32px",
              border: "2px solid #eef0f3",
              background: "white",
              position: "relative", overflow: "hidden",
            }}>
              <div style={{
                position: "absolute", left: 0, top: 0, bottom: 0,
                width: 5, background: s.accent, borderRadius: "12px 0 0 12px",
              }} />
              <p style={{
                fontFamily: "'Outfit', sans-serif",
                fontSize: 10, fontWeight: 700,
                color: s.accent, letterSpacing: "2.5px", textTransform: "uppercase",
                marginBottom: 8,
              }}>{s.day}</p>
              <h3 style={{
                fontFamily: "'Outfit', sans-serif", fontWeight: 900,
                fontSize: 30, color: DARK, lineHeight: 1, letterSpacing: "-0.5px",
                marginBottom: 8,
              }}>{s.time}</h3>
              <p style={{
                fontFamily: "'Outfit', sans-serif", fontWeight: 700,
                fontSize: 15, color: DARK,
              }}>{s.label}</p>
            </div>
          ))}
        </div>
        <div style={{ textAlign: "center", marginTop: 48 }}>
          <button className="btn-primary" onClick={() => navigate("calendar")}>View Full Calendar →</button>
        </div>
      </section>

      {/* ——— CTA BANNER ——— */}
      <section style={{
        padding: "100px 40px",
        background: `linear-gradient(135deg, ${BLUE} 0%, #0087ae 100%)`,
        textAlign: "center",
      }} className="content-pad">
        <p style={{
          fontFamily: "'Outfit', sans-serif",
          color: "rgba(255,255,255,0.7)",
          fontSize: 11, letterSpacing: "4px", textTransform: "uppercase", marginBottom: 20,
        }}>
          You're Invited
        </p>
        <h2 style={{
          fontFamily: "'Outfit', sans-serif", fontWeight: 900,
          fontSize: "clamp(36px, 6vw, 68px)",
          color: "white", lineHeight: 1.05,
          marginBottom: 24, letterSpacing: "-1.5px",
        }}>
          You're Always<br />Welcome Here
        </h2>
        <p style={{
          fontFamily: "'Outfit', sans-serif",
          color: "rgba(255,255,255,0.8)",
          fontSize: 18,
          marginBottom: 48,
        }}>
          No matter where you've been, there's always a seat for you at 1AG.
        </p>
        <button
          onClick={() => navigate("visit")}
          style={{
            background: "white", color: BLUE,
            border: "none", borderRadius: 5,
            padding: "18px 48px",
            fontFamily: "'Outfit', sans-serif",
            fontWeight: 900, fontSize: 15,
            cursor: "pointer", letterSpacing: "1px", textTransform: "uppercase",
            boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
            transition: "transform 0.15s",
          }}
        >
          Plan Your Visit
        </button>
      </section>

      {/* ——— GIVING SECTION ——— */}
      <section style={{ padding: "96px 40px", background: "#F5F7FA" }} className="content-pad">
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 72,
            alignItems: "center",
          }} className="grid-2">
            {/* Left: copy */}
            <div>
              <p className="section-tag">Generosity</p>
              <h2 style={{
                fontFamily: "'Outfit', sans-serif", fontWeight: 900,
                fontSize: "clamp(36px, 5vw, 56px)", lineHeight: 1.05,
                color: DARK, marginBottom: 24, letterSpacing: "-1px",
              }}>
                Give & Make<br />a Difference
              </h2>
              <p style={{
                fontFamily: "'Outfit', sans-serif",
                color: "#5a6370", fontSize: 17, lineHeight: 1.9,
                marginBottom: 20,
              }}>
                Your generosity fuels everything we do — from feeding families in our community to reaching people around the world with the Gospel. Every gift, big or small, matters.
              </p>
              <p style={{
                fontFamily: "'Outfit', sans-serif",
                color: "#5a6370", fontSize: 17, lineHeight: 1.9,
                marginBottom: 40,
              }}>
                Giving at 1AG is safe, simple, and secure. Give online anytime, set up recurring giving, or bring your offering in person on Sundays.
              </p>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                <a
                  href={settings.givingUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 8,
                    background: BLUE, color: "white",
                    border: "none", borderRadius: 5,
                    padding: "16px 36px",
                    fontFamily: "'Outfit', sans-serif",
                    fontWeight: 800, fontSize: 14,
                    letterSpacing: "1px", textTransform: "uppercase",
                    textDecoration: "none",
                    cursor: "pointer",
                    boxShadow: `0 8px 28px ${BLUE}44`,
                    transition: "transform 0.15s, background 0.2s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.background = "#0193ba"; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.background = BLUE; }}
                >
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 18s-7-4.686-7-10a7 7 0 0 1 14 0c0 5.314-7 10-7 10z" />
                    <circle cx="10" cy="8" r="2.5" fill="white" />
                  </svg>
                  Give Online
                </a>
              </div>
            </div>

            {/* Right: giving cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {[
                { label: "Global Missions", desc: "Supporting missionaries and church plants carrying the Gospel around the world." },
                { label: "Local & Global Outreach", desc: "We regularly go beyond our walls — serving our community and reaching the world through hands-on outreach and compassion ministry." },
                { label: "Youth & Education", desc: "Investing in the next generation through discipleship programs." },
                { label: "Church Operations", desc: "Keeping the lights on so every service can happen." },
              ].map(item => (
                <div key={item.label} style={{
                  background: "white",
                  borderRadius: 10, padding: "20px 24px",
                  display: "flex", alignItems: "center", gap: 18,
                  boxShadow: "0 2px 14px rgba(0,0,0,0.05)",
                  border: "1px solid #eef0f3",
                }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 15, color: DARK, marginBottom: 3 }}>
                      {item.label}
                    </p>
                    <p style={{ fontFamily: "'Outfit', sans-serif", color: "#7a8490", fontSize: 13, lineHeight: 1.6 }}>
                      {item.desc}
                    </p>
                  </div>
                  <div style={{
                    marginLeft: "auto", flexShrink: 0,
                    width: 8, height: 8, borderRadius: "50%",
                    background: BLUE,
                  }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Footer navigate={navigate} settings={settings} />
    </div>
  );
}

// ——————————————————————————————————————————————————————————————————————————
// CALENDAR PAGE
// ——————————————————————————————————————————————————————————————————————————
function CalendarPage({ navigate, settings }) {
  const calId = settings?.calendarId || "";
  const calSrc = calId
    ? `https://calendar.google.com/calendar/embed?src=${encodeURIComponent(calId)}&ctz=America%2FNew_York&showTitle=0&showNav=1&showDate=1&showPrint=0&showTabs=1&showCalendars=0&mode=MONTH&color=%2301A8D7`
    : "";

  return (
    <div style={{ paddingTop: 72, minHeight: "100vh", background: "#F5F7FA" }}>
      <div className="page-header">
        <p className="section-tag">Events & Services</p>
        <h1 style={{
          fontFamily: "'Outfit', sans-serif", fontWeight: 900,
          fontSize: "clamp(42px, 7vw, 76px)",
          color: "white", lineHeight: 1.0, letterSpacing: "-2px",
        }}>
          Church Calendar
        </h1>
        <p style={{
          fontFamily: "'Outfit', sans-serif",
          color: "rgba(255,255,255,0.55)", fontSize: 18,
          marginTop: 20, fontWeight: 300,
        }}>
          Stay connected with everything happening at 1AG
        </p>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "56px 40px" }} className="content-pad">
        {/* Setup notice */}
        <div style={{
          background: `${BLUE}12`,
          border: `2px solid ${BLUE}30`,
          borderLeft: `4px solid ${BLUE}`,
          borderRadius: 8, padding: "20px 28px",
          display: "flex", gap: 16, alignItems: "flex-start",
          marginBottom: 32,
        }}>
          <span style={{ fontSize: 22, flexShrink: 0 }}>ℹ️</span>
          <div>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, color: DARK, fontSize: 15, marginBottom: 6 }}>
              Google Calendar Setup
            </p>
            <p style={{ fontFamily: "'Outfit', sans-serif", color: "#5a6370", fontSize: 14, lineHeight: 1.7 }}>
              To connect your church's Google Calendar: Open Google Calendar → Click the ⋮ menu on your calendar → <strong>Settings and sharing</strong> → Scroll to <strong>"Integrate calendar"</strong> → Copy your <strong>Calendar ID</strong> and <strong>API Key</strong>, then paste them in the Admin panel → ⚙️ Settings.
            </p>
          </div>
        </div>

        {/* Calendar embed */}
        <div style={{
          background: "white", borderRadius: 12,
          overflow: "hidden",
          boxShadow: "0 4px 24px rgba(0,0,0,0.07)",
        }}>
          <div style={{
            background: DARK, padding: "16px 28px",
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <div style={{
              width: 10, height: 10, borderRadius: "50%",
              background: "#ff5f56", marginRight: 2
            }} />
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ffbd2e" }} />
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#27c93f" }} />
            <span style={{ fontFamily: "'Outfit', sans-serif", color: "rgba(255,255,255,0.4)", fontSize: 13, marginLeft: 12 }}>
              1AG Church — Google Calendar
            </span>
          </div>
          {calSrc ? (
            <iframe
              src={calSrc}
              title="1AG Church Calendar"
              style={{ width: "100%", height: 620, border: "none", display: "block" }}
            />
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, color: "#aaa", fontFamily: "'Outfit', sans-serif", fontSize: 15 }}>
              Calendar not connected yet. Add your Calendar ID in Admin → ⚙️ Settings.
            </div>
          )}
        </div>

        {/* Service times grid */}
        <h3 style={{
          fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 26,
          color: DARK, marginTop: 64, marginBottom: 32,
        }}>Regular Service Times</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 20 }} className="grid-2">
          {[
            {
              day: "Sunday Morning",
              time: settings.sundayTime,
              label: "Sunday Service",
              accent: BLUE,
              note: "Main worship service for all ages",
            },
            {
              day: "Sunday Night",
              time: settings.youthTime,
              label: "Youth Group",
              accent: DARK,
              note: "Middle & high school students",
            },
          ].map(s => (
            <div key={s.day} style={{
              background: "white",
              borderRadius: 12,
              padding: "36px 32px",
              boxShadow: "0 2px 16px rgba(0,0,0,0.05)",
              border: "1px solid #eef0f3",
              display: "flex",
              flexDirection: "column",
              gap: 6,
              position: "relative",
              overflow: "hidden",
            }}>
              {/* Left accent bar */}
              <div style={{
                position: "absolute", left: 0, top: 0, bottom: 0,
                width: 5, background: s.accent, borderRadius: "12px 0 0 12px",
              }} />
              <p style={{
                fontFamily: "'Outfit', sans-serif",
                fontSize: 11, fontWeight: 700,
                color: s.accent,
                letterSpacing: "2.5px", textTransform: "uppercase",
                marginBottom: 4,
              }}>
                {s.day}
              </p>
              <h4 style={{
                fontFamily: "'Outfit', sans-serif", fontWeight: 900,
                fontSize: 32, color: DARK, lineHeight: 1, letterSpacing: "-0.5px",
              }}>
                {s.time}
              </h4>
              <p style={{
                fontFamily: "'Outfit', sans-serif", fontWeight: 700,
                fontSize: 16, color: DARK, marginTop: 6,
              }}>
                {s.label}
              </p>
              <p style={{
                fontFamily: "'Outfit', sans-serif",
                fontSize: 13, color: "#94a3b8",
              }}>
                {s.note}
              </p>
            </div>
          ))}
        </div>

        {/* Location */}
        <div style={{
          background: DARK, borderRadius: 12,
          padding: "48px",
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40,
          alignItems: "center",
          marginTop: 40,
        }} className="grid-2">
          <div>
            <p className="section-tag" style={{ color: BLUE }}>Find Us</p>
            <h3 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 28, color: "white", marginBottom: 16 }}>
              Our Location
            </h3>
            <p style={{ fontFamily: "'Outfit', sans-serif", color: "rgba(255,255,255,0.55)", fontSize: 16, lineHeight: 1.9 }}>
              {settings.address}
            </p>
            <p style={{ fontFamily: "'Outfit', sans-serif", color: "rgba(255,255,255,0.55)", fontSize: 15, lineHeight: 1.9, marginTop: 16 }}>
              📞 {settings.phone}<br />
              ✉️ {settings.email}
            </p>
          </div>
          <div style={{
            borderRadius: 12, overflow: "hidden",
            boxShadow: "0 4px 24px rgba(0,0,0,0.2)",
          }}>
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3095.6771291008554!2d-90.33796688826455!3d39.11382033378675!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x87df12ffb740dad1%3A0xbfa092e2adfa7fa5!2s500%20Cross%20Ave%2C%20Jerseyville%2C%20IL%2062052!5e0!3m2!1sen!2sus!4v1771091300087!5m2!1sen!2sus"
              width="100%"
              height="340"
              style={{ border: 0, display: "block" }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="1AG Church Location"
            />
          </div>
        </div>
      </div>

      <Footer navigate={navigate} settings={settings} />
    </div>
  );
}

// ——————————————————————————————————————————————————————————————————————————
// PLAN YOUR VISIT PAGE
// ——————————————————————————————————————————————————————————————————————————
function PlanVisitPage({ navigate, settings }) {
  const steps = [
    {
      number: "01",
      title: "Getting Here",
      body: `We're located at ${settings.address}. When you arrive, head to the Main Church Entry — it's clearly marked and you'll be greeted by our team right at the door. If you have any questions, our Welcome Center attendant is there to help.`,
    },
    {
      number: "02",
      title: "Kids & Family",
      body: "Your children are fully welcome here! We offer age-appropriate environments for newborns through 5th grade during every Sunday service. Our check-in stations open 20 minutes before service. All volunteers are background-checked and trained.",
    },
    {
      number: "03",
      title: "The Worship Experience",
      body: "Expect contemporary, Spirit-led worship music followed by a relevant, Bible-based message that speaks to everyday life. Services run about 1 hour. Come as you are — we mean that literally.",
    },
    {
      number: "04",
      title: "Coffee & Community",
      body: "Kick things off right — we serve coffee and donuts before service so you can settle in, meet people, and feel at home before worship begins. First-time guest gifts are available for you at the Welcome Center.",
    },
  ];

  const faqs = [
    { q: "What should I wear?", a: "Come exactly as you are. You'll see everything from jeans and sneakers to dress clothes — no dress code here." },
    { q: "How long is the service?", a: `Our Sunday services run about 1 hour. We meet at ${settings.sundayTime} every Sunday.` },
    { q: "Is there parking?", a: "Yes! Free parking is available on-site. Head to the Main Church Entry — it's clearly marked and our greeters will be right there to welcome you." },
    { q: "What about my kids?", a: "We have dedicated, safe, and fun environments for kids from birth through 5th grade at every Sunday service." },
    { q: "Do I have to sign up in advance?", a: "Nope — just show up! We'd love to have you. No registration needed for Sunday services." },
    { q: "Will anyone put me on the spot?", a: "Absolutely not. You're free to sit back, observe, and take it all in. We'll never single out first-time guests." },
  ];

  const [openFaq, setOpenFaq] = useState(null);

  return (
    <div style={{ paddingTop: 72, minHeight: "100vh", background: "white" }}>

      {/* ——— PAGE HEADER ——— */}
      <div style={{
        background: `linear-gradient(145deg, ${DARK} 0%, #0d1e2c 100%)`,
        padding: "100px 40px 0",
        textAlign: "center",
        overflow: "hidden",
        position: "relative",
      }}>
        {/* Subtle grid texture */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: `linear-gradient(rgba(1,168,215,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(1,168,215,0.05) 1px, transparent 1px)`,
          backgroundSize: "50px 50px",
        }} />
        {/* Blue glow */}
        <div style={{
          position: "absolute", top: -100, right: "10%",
          width: 500, height: 500, borderRadius: "50%",
          background: `radial-gradient(circle, ${BLUE}22 0%, transparent 65%)`,
          pointerEvents: "none",
        }} />

        <div style={{ position: "relative", zIndex: 1 }}>
          <p className="section-tag">First Time Here?</p>
          <h1 style={{
            fontFamily: "'Outfit', sans-serif", fontWeight: 900,
            fontSize: "clamp(48px, 8vw, 86px)",
            color: "white", lineHeight: 1.0, letterSpacing: "-2.5px",
            marginBottom: 20,
          }}>
            Plan Your Visit
          </h1>
          <p style={{
            fontFamily: "'Outfit', sans-serif",
            color: "rgba(255,255,255,0.55)", fontSize: 19,
            fontWeight: 300, lineHeight: 1.75,
            maxWidth: 580, margin: "0 auto 56px",
          }}>
            We want your first experience at 1AG to feel effortless.<br />Here's everything you need to know before you arrive.
          </p>

          {/* Service time pills */}
          <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap", paddingBottom: 64 }}>
            {[
              { time: settings.sundayTime, label: "Sunday Service" },
            ].map(s => (
              <div key={s.time} style={{
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 100,
                padding: "12px 28px",
                display: "flex", alignItems: "center", gap: 12,
              }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: BLUE, display: "inline-block", flexShrink: 0 }} />
                <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 15, color: "white" }}>{s.time}</span>
                <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.45)", letterSpacing: "1px" }}>{s.label}</span>
              </div>
            ))}
            <div style={{
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 100,
              padding: "12px 28px",
              display: "flex", alignItems: "center", gap: 12,
            }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#34d399", display: "inline-block", flexShrink: 0 }} />
              <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 15, color: "white" }}>Sundays</span>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.45)", letterSpacing: "1px" }}>Every Week</span>
            </div>
          </div>
        </div>
      </div>

      {/* ——— WHAT TO EXPECT STEPS ——— */}
      <section style={{ padding: "88px 40px", background: "white" }} className="content-pad">
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <p className="section-tag">Step by Step</p>
            <h2 style={{
              fontFamily: "'Outfit', sans-serif", fontWeight: 900,
              fontSize: "clamp(34px, 5vw, 52px)", color: DARK, letterSpacing: "-1px",
            }}>
              What to Expect
            </h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "28px" }} className="grid-2">
            {steps.map((step, i) => (
              <div key={i} style={{
                padding: "40px 36px",
                background: BLUE,
                borderRadius: 12,
                position: "relative",
                overflow: "hidden",
              }}>
                {/* Background number watermark */}
                <span style={{
                  position: "absolute", top: -10, right: 16,
                  fontFamily: "'Outfit', sans-serif",
                  fontWeight: 900, fontSize: 96,
                  color: "rgba(255,255,255,0.12)",
                  lineHeight: 1, userSelect: "none",
                  pointerEvents: "none",
                }}>
                  {step.number}
                </span>
                <p style={{
                  fontFamily: "'Outfit', sans-serif",
                  fontWeight: 700, fontSize: 11,
                  color: "rgba(255,255,255,0.6)",
                  letterSpacing: "3px", textTransform: "uppercase",
                  marginBottom: 12,
                }}>
                  {step.number}
                </p>
                <h3 style={{
                  fontFamily: "'Outfit', sans-serif", fontWeight: 900,
                  fontSize: 22, color: "white", marginBottom: 14,
                  letterSpacing: "-0.3px",
                }}>
                  {step.title}
                </h3>
                <p style={{
                  fontFamily: "'Outfit', sans-serif", color: "rgba(255,255,255,0.82)",
                  fontSize: 15, lineHeight: 1.85,
                }}>
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ——— ADDRESS / MAP STRIP ——— */}
      <section style={{
        background: `linear-gradient(135deg, ${DARK} 0%, #0d2030 100%)`,
        padding: "72px 40px",
      }} className="content-pad">
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 56, alignItems: "center" }} className="grid-2">
          <div>
            <p className="section-tag" style={{ color: BLUE }}>Find Us</p>
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900, fontSize: "clamp(30px, 4vw, 46px)", color: "white", marginBottom: 24, letterSpacing: "-0.5px" }}>
              We're Saving a Seat<br />Just for You
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {[
                { icon: "📍", label: "Address", value: settings.address },
                { icon: "🗓️", label: "Sundays", value: settings.sundayTime },
                { icon: "📞", label: "Phone", value: settings.phone },
                { icon: "✉️", label: "Email", value: settings.email },
              ].map(item => (
                <div key={item.label} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}>{item.icon}</span>
                  <div>
                    <p style={{ fontFamily: "'Outfit', sans-serif", color: BLUE, fontSize: 11, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 3 }}>{item.label}</p>
                    <p style={{ fontFamily: "'Outfit', sans-serif", color: "rgba(255,255,255,0.7)", fontSize: 15 }}>{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 14, marginTop: 36, flexWrap: "wrap" }}>
              <button className="btn-primary" onClick={() => navigate("calendar")}>
                View Events Calendar
              </button>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(settings.address)}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  background: "rgba(255,255,255,0.08)",
                  border: "2px solid rgba(255,255,255,0.15)",
                  color: "white",
                  borderRadius: 5, padding: "14px 24px",
                  fontFamily: "'Outfit', sans-serif",
                  fontWeight: 700, fontSize: 13,
                  textDecoration: "none",
                  cursor: "pointer",
                  transition: "background 0.2s",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.14)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
              >
                Get Directions →
              </a>
            </div>
          </div>
          {/* Map placeholder */}
          <div style={{ borderRadius: 12, overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.2)" }}>
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3095.6771291008554!2d-90.33796688826455!3d39.11382033378675!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x87df12ffb740dad1%3A0xbfa092e2adfa7fa5!2s500%20Cross%20Ave%2C%20Jerseyville%2C%20IL%2062052!5e0!3m2!1sen!2sus!4v1771091300087!5m2!1sen!2sus"
              width="100%"
              height="320"
              style={{ border: 0, display: "block" }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="1AG Church Location"
            />
          </div>
        </div>
      </section>

      {/* ——— FAQ ——— */}
      <section style={{ padding: "88px 40px", background: "#F5F7FA" }} className="content-pad">
        <div style={{ maxWidth: 780, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <p className="section-tag">Got Questions?</p>
            <h2 style={{
              fontFamily: "'Outfit', sans-serif", fontWeight: 900,
              fontSize: "clamp(32px, 5vw, 50px)", color: DARK, letterSpacing: "-1px",
            }}>
              We've Got Answers
            </h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {faqs.map((faq, i) => (
              <div
                key={i}
                style={{
                  background: "white",
                  borderRadius: 10,
                  border: `2px solid ${openFaq === i ? BLUE : "#eef0f3"}`,
                  overflow: "hidden",
                  transition: "border-color 0.2s",
                  boxShadow: openFaq === i ? `0 4px 20px ${BLUE}18` : "none",
                }}
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  style={{
                    width: "100%", padding: "22px 28px",
                    background: "none", border: "none", cursor: "pointer",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    gap: 16,
                  }}
                >
                  <span style={{
                    fontFamily: "'Outfit', sans-serif", fontWeight: 700,
                    fontSize: 16, color: DARK, textAlign: "left",
                  }}>
                    {faq.q}
                  </span>
                  <span style={{
                    width: 28, height: 28, borderRadius: "50%",
                    background: openFaq === i ? BLUE : "#f0f0f0",
                    color: openFaq === i ? "white" : "#888",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                    fontWeight: 700, fontSize: 16,
                    transition: "background 0.2s, color 0.2s, transform 0.2s",
                    transform: openFaq === i ? "rotate(45deg)" : "rotate(0deg)",
                  }}>
                    +
                  </span>
                </button>
                {openFaq === i && (
                  <div style={{
                    padding: "0 28px 24px",
                    animation: "fadeSlideUp 0.2s ease",
                  }}>
                    <p style={{
                      fontFamily: "'Outfit', sans-serif",
                      color: "#5a6370", fontSize: 15, lineHeight: 1.85,
                    }}>
                      {faq.a}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ——— FINAL CTA ——— */}
      <section style={{
        padding: "96px 40px",
        background: `linear-gradient(135deg, ${BLUE} 0%, #0087ae 100%)`,
        textAlign: "center",
      }} className="content-pad">
        <p style={{ fontFamily: "'Outfit', sans-serif", color: "rgba(255,255,255,0.65)", fontSize: 11, letterSpacing: "4px", textTransform: "uppercase", marginBottom: 20 }}>
          Ready?
        </p>
        <h2 style={{
          fontFamily: "'Outfit', sans-serif", fontWeight: 900,
          fontSize: "clamp(36px, 6vw, 64px)",
          color: "white", lineHeight: 1.05,
          marginBottom: 20, letterSpacing: "-1.5px",
        }}>
          We Can't Wait<br />to Meet You
        </h2>
        <p style={{ fontFamily: "'Outfit', sans-serif", color: "rgba(255,255,255,0.75)", fontSize: 17, marginBottom: 44, fontWeight: 300 }}>
          No expectations. No pressure. Just a warm welcome waiting for you.
        </p>
        <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
          <button
            onClick={() => navigate("calendar")}
            style={{
              background: "white", color: BLUE,
              border: "none", borderRadius: 5,
              padding: "17px 40px",
              fontFamily: "'Outfit', sans-serif",
              fontWeight: 900, fontSize: 14,
              cursor: "pointer", letterSpacing: "1px", textTransform: "uppercase",
              boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
              transition: "transform 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}
          >
            See Service Times
          </button>
          <a
            href={settings.watchLiveUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "transparent",
              border: "2px solid rgba(255,255,255,0.5)",
              color: "white", borderRadius: 5,
              padding: "17px 32px",
              fontFamily: "'Outfit', sans-serif",
              fontWeight: 700, fontSize: 14,
              textDecoration: "none", cursor: "pointer",
              transition: "background 0.2s, border-color 0.2s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; e.currentTarget.style.borderColor = "white"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.5)"; }}
          >
            Watch Online First
          </a>
        </div>
      </section>

      <Footer navigate={navigate} settings={settings} />
    </div>
  );
}

// ——————————————————————————————————————————————————————————————————————————
// SERMONS PAGE
// ——————————————————————————————————————————————————————————————————————————
function SermonsPage({ sermons, navigate, settings }) {
  const [search, setSearch] = useState("");
  const [series, setSeries] = useState("All");
  const [speaker, setSpeaker] = useState("All");
  const [year, setYear] = useState("All");
  const [modal, setModal] = useState(null);

  const allSeries = ["All", ...Array.from(new Set(sermons.map(s => s.series).filter(Boolean)))
    .sort((a, b) => {
      const latestA = Math.max(...sermons.filter(s => s.series === a).map(s => new Date(s.date)));
      const latestB = Math.max(...sermons.filter(s => s.series === b).map(s => new Date(s.date)));
      return latestB - latestA;
    })];

  const allSpeakers = ["All", ...Array.from(new Set(sermons.map(s => s.speaker).filter(Boolean))).sort()];

  const allYears = ["All", ...Array.from(new Set(sermons.map(s => s.date ? new Date(s.date).getFullYear() : null).filter(Boolean))).sort((a, b) => b - a)];

  const hasActiveFilters = speaker !== "All" || year !== "All" || series !== "All" || search;

  const clearFilters = () => { setSpeaker("All"); setYear("All"); setSeries("All"); setSearch(""); };

  const filtered = sermons.filter(s => {
    const q = search.toLowerCase();
    const matchSearch = !q || s.title.toLowerCase().includes(q) || s.speaker.toLowerCase().includes(q) || (s.series || "").toLowerCase().includes(q);
    const matchSeries = series === "All" || s.series === series;
    const matchSpeaker = speaker === "All" || s.speaker === speaker;
    const matchYear = year === "All" || (s.date && new Date(s.date).getFullYear() === parseInt(year));
    return matchSearch && matchSeries && matchSpeaker && matchYear;
  }).sort((a, b) => new Date(b.date) - new Date(a.date));

  const extractId = (val) => {
    const match = val.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|live\/|watch\?v=|watch\?.+&v=))([^&?\/\s]{11})/);
    return match ? match[1] : val.trim();
  };

  return (
    <div style={{ paddingTop: 72, minHeight: "100vh", background: "#F5F7FA" }}>
      {/* Modal */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div
            style={{
              background: "white", borderRadius: 12,
              maxWidth: 860, width: "100%",
              overflow: "hidden",
              animation: "fadeSlideUp 0.25s ease",
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ aspectRatio: "16/9", background: DARK }}>
              <iframe
                src={`https://www.youtube.com/embed/${extractId(modal.youtubeId)}?autoplay=1`}
                title={modal.title}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{ width: "100%", height: "100%", display: "block" }}
              />
            </div>
            <div style={{ padding: "28px 36px 36px" }}>
              <p style={{ color: BLUE, fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "2.5px", textTransform: "uppercase", marginBottom: 10 }}>
                {modal.series}
              </p>
              <h3 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 24, color: DARK, marginBottom: 10 }}>
                {modal.title}
              </h3>
              <p style={{ fontFamily: "'Outfit', sans-serif", color: "#5a6370", fontSize: 15, lineHeight: 1.75, marginBottom: 20 }}>
                {modal.description}
              </p>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                <p style={{ fontFamily: "'Outfit', sans-serif", color: "#888", fontSize: 14 }}>
                  {modal.speaker} · {new Date(modal.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                </p>
                <button
                  onClick={() => setModal(null)}
                  style={{
                    background: "#f0f0f0", color: DARK,
                    border: "none", borderRadius: 5, padding: "10px 24px",
                    fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  Close ✕
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="page-header">
        <p className="section-tag">Messages & Teaching</p>
        <h1 style={{
          fontFamily: "'Outfit', sans-serif", fontWeight: 900,
          fontSize: "clamp(42px, 7vw, 76px)",
          color: "white", lineHeight: 1.0, letterSpacing: "-2px",
        }}>
          Sermon Archive
        </h1>
        <p style={{
          fontFamily: "'Outfit', sans-serif",
          color: "rgba(255,255,255,0.55)", fontSize: 18,
          marginTop: 20, fontWeight: 300,
        }}>
          Every message, available on demand
        </p>

        {/* Search */}
        <div style={{ maxWidth: 520, margin: "36px auto 0", position: "relative" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2"
            style={{ position: "absolute", left: 18, top: "50%", transform: "translateY(-50%)" }}>
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by title, speaker, or series..."
            className={`input-field ${search ? "active" : ""}`}
            style={{
              width: "100%", padding: "16px 20px 16px 48px",
              borderRadius: 8, border: "none",
              fontFamily: "'Outfit', sans-serif", fontSize: 15,
              background: "rgba(255,255,255,0.1)",
              color: "white", outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "48px 40px" }} className="content-pad">
        {/* Filter bar */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 28 }}>
          {/* Series dropdown */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#555", whiteSpace: "nowrap" }}>
              Series
            </label>
            <select
              value={series}
              onChange={e => setSeries(e.target.value)}
              style={{
                fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 500,
                color: series !== "All" ? BLUE : "#444",
                background: series !== "All" ? "#e8f6fb" : "white",
                border: `1.5px solid ${series !== "All" ? BLUE : "#dde1e7"}`,
                borderRadius: 8, padding: "8px 32px 8px 14px",
                appearance: "none", WebkitAppearance: "none",
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 10px center",
                cursor: "pointer", outline: "none",
              }}
            >
              {allSeries.map(s => (
                <option key={s} value={s}>{s === "All" ? "All Series" : s}</option>
              ))}
            </select>
          </div>

          {/* Speaker dropdown */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#555", whiteSpace: "nowrap" }}>
              Speaker
            </label>
            <select
              value={speaker}
              onChange={e => setSpeaker(e.target.value)}
              style={{
                fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 500,
                color: speaker !== "All" ? BLUE : "#444",
                background: speaker !== "All" ? "#e8f6fb" : "white",
                border: `1.5px solid ${speaker !== "All" ? BLUE : "#dde1e7"}`,
                borderRadius: 8, padding: "8px 32px 8px 14px",
                appearance: "none", WebkitAppearance: "none",
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 10px center",
                cursor: "pointer", outline: "none",
              }}
            >
              {allSpeakers.map(sp => (
                <option key={sp} value={sp}>{sp === "All" ? "All Speakers" : sp}</option>
              ))}
            </select>
          </div>

          {/* Year dropdown */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#555", whiteSpace: "nowrap" }}>
              Year
            </label>
            <select
              value={year}
              onChange={e => setYear(e.target.value)}
              style={{
                fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 500,
                color: year !== "All" ? BLUE : "#444",
                background: year !== "All" ? "#e8f6fb" : "white",
                border: `1.5px solid ${year !== "All" ? BLUE : "#dde1e7"}`,
                borderRadius: 8, padding: "8px 32px 8px 14px",
                appearance: "none", WebkitAppearance: "none",
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 10px center",
                cursor: "pointer", outline: "none",
              }}
            >
              {allYears.map(y => (
                <option key={y} value={y}>{y === "All" ? "All Years" : y}</option>
              ))}
            </select>
          </div>

          {/* Clear filters button */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              style={{
                background: "none", border: "1.5px solid #dde1e7",
                borderRadius: 8, padding: "8px 16px",
                fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600,
                color: "#888", cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
              Clear filters
            </button>
          )}
        </div>

        {/* Count */}
        <p style={{ fontFamily: "'Outfit', sans-serif", color: "#888", fontSize: 14, marginBottom: 24 }}>
          {filtered.length} sermon{filtered.length !== 1 ? "s" : ""} found
        </p>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 20px" }}>
            <span style={{ fontSize: 48, display: "block", marginBottom: 16 }}>🤔</span>
            <p style={{ fontFamily: "'Outfit', sans-serif", color: "#888", fontSize: 18 }}>
              No sermons match your search.
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 28 }}>
            {filtered.map(sermon => (
              <div
                key={sermon.id}
                className="sermon-card"
                onClick={() => setModal(sermon)}
              >
                {/* Thumbnail */}
                <div style={{ position: "relative", aspectRatio: "16/9", background: DARK, overflow: "hidden" }}>
                  <img
                    src={`https://img.youtube.com/vi/${extractId(sermon.youtubeId)}/maxresdefault.jpg`}
                    alt={sermon.title}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    data-fallbacks={JSON.stringify([
                      `https://img.youtube.com/vi/${extractId(sermon.youtubeId)}/hqdefault.jpg`,
                      `https://img.youtube.com/vi/${extractId(sermon.youtubeId)}/mqdefault.jpg`,
                      `https://img.youtube.com/vi/${extractId(sermon.youtubeId)}/sddefault.jpg`,
                      `https://img.youtube.com/vi/${extractId(sermon.youtubeId)}/default.jpg`,
                    ])}
                    onError={e => {
                      const fallbacks = JSON.parse(e.target.dataset.fallbacks || "[]");
                      if (fallbacks.length > 0) { e.target.src = fallbacks.shift(); e.target.dataset.fallbacks = JSON.stringify(fallbacks); }
                    }}
                  />
                  {/* Play overlay */}
                  <div style={{
                    position: "absolute", inset: 0,
                    background: "rgba(0,0,0,0.3)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "background 0.2s",
                  }}>
                    <div style={{
                      width: 52, height: 52, borderRadius: "50%",
                      background: BLUE,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: "0 4px 20px rgba(1,168,215,0.5)",
                    }}>
                      <svg width="18" height="18" viewBox="0 0 20 20" fill="white">
                        <polygon points="7,3 18,10 7,17" />
                      </svg>
                    </div>
                  </div>
                  {/* Series badge */}
                  {sermon.series && (
                    <div style={{
                      position: "absolute", top: 12, left: 12,
                      background: BLUE,
                      color: "white", borderRadius: 4,
                      padding: "4px 10px",
                      fontFamily: "'Outfit', sans-serif",
                      fontSize: 11, fontWeight: 700, letterSpacing: "1px",
                    }}>
                      {sermon.series}
                    </div>
                  )}
                </div>
                <div style={{ padding: "22px 24px 28px" }}>
                  <h3 style={{
                    fontFamily: "'Outfit', sans-serif", fontWeight: 800,
                    fontSize: 18, color: DARK,
                    lineHeight: 1.3, marginBottom: 10,
                  }}>
                    {sermon.title}
                  </h3>
                  <p style={{ fontFamily: "'Outfit', sans-serif", color: "#777", fontSize: 14, marginBottom: 6 }}>
                    {sermon.speaker}
                  </p>
                  <p style={{ fontFamily: "'Outfit', sans-serif", color: "#bbb", fontSize: 12 }}>
                    {sermon.date ? new Date(sermon.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Footer navigate={navigate} settings={settings} />
    </div>
  );
}

// ——————————————————————————————————————————————————————————————————————————
// ABOUT PAGE
// ——————————————————————————————————————————————————————————————————————————
const BELIEFS = [
  { label: "The Scriptures Inspired", text: "The Bible, both Old and New Testaments, is verbally inspired of God and is the revelation of God to man — the infallible, authoritative rule of faith and conduct." },
  { label: "The One True God", text: "The one true God has revealed Himself as the eternally self-existent Creator of heaven and earth, and in the Trinity of Father, Son, and Holy Spirit." },
  { label: "The Deity of Christ", text: "The Lord Jesus Christ is the eternal Son of God. The Scriptures declare His virgin birth, sinless life, miracles, substitutionary death, bodily resurrection, and exaltation to the right hand of God." },
  { label: "The Fall of Man", text: "Man was created good and upright, but by voluntary transgression fell, incurring not only physical death but also spiritual death, which is separation from God." },
  { label: "The Salvation of Man", text: "Man's only hope of redemption is through the shed blood of Jesus Christ. Salvation is received through repentance toward God and faith in the Lord Jesus Christ." },
  { label: "The Ordinances of the Church", text: "Baptism in water by immersion is commanded in Scripture for all who repent and believe. The Lord's Supper is a memorial of Christ's suffering and death and a prophecy of His second coming." },
  { label: "The Baptism in the Holy Spirit", text: "All believers are entitled to and should earnestly seek the promise of the Father — the baptism in the Holy Spirit and fire — according to the command of our Lord Jesus Christ." },
  { label: "The Initial Physical Evidence", text: "The baptism of believers in the Holy Spirit is witnessed by the initial physical sign of speaking with other tongues as the Spirit of God gives them utterance." },
  { label: "Sanctification", text: "Sanctification is an act of separation from that which is evil and dedication unto God. The Scriptures teach a life of holiness without which no man shall see the Lord." },
  { label: "The Church and Its Mission", text: "The Church is the body of Christ, the habitation of God through the Spirit, with divine appointments for the fulfillment of her great commission to evangelize the world." },
  { label: "The Ministry", text: "A divinely called and scripturally ordained ministry has been provided by our Lord for the purpose of leading the Church in evangelization, worship, and building up the body of saints." },
  { label: "Divine Healing", text: "Divine healing is an integral part of the gospel. Deliverance from sickness is provided for in the atonement and is the privilege of all believers." },
  { label: "The Blessed Hope", text: "The resurrection of those who have fallen asleep in Christ and their translation together with those who are alive at the coming of the Lord is the imminent and blessed hope of the Church." },
  { label: "The Millennial Reign", text: "The second coming of Christ includes the rapture of the saints, followed by the visible return of Christ with His saints to reign on earth for a thousand years." },
  { label: "The Final Judgment", text: "There will be a final judgment in which the wicked dead will be raised and judged according to their works. Whoever is not found written in the Book of Life will be consigned to everlasting punishment." },
  { label: "The New Heavens & New Earth", text: "We look forward to a new heaven and a new earth in which dwells righteousness — the eternal home of the redeemed." },
];

function AboutPage({ staff, navigate, settings }) {
  return (
    <div style={{ paddingTop: 72, minHeight: "100vh", background: "white" }}>

      {/* ——— HEADER ——— */}
      <div style={{
        background: `linear-gradient(145deg, ${DARK} 0%, #0d1e2c 100%)`,
        padding: "100px 40px 96px",
        textAlign: "center",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: `linear-gradient(rgba(1,168,215,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(1,168,215,0.05) 1px, transparent 1px)`,
          backgroundSize: "50px 50px",
        }} />
        <div style={{
          position: "absolute", top: -80, left: "50%", transform: "translateX(-50%)",
          width: 600, height: 400, borderRadius: "50%",
          background: `radial-gradient(circle, ${BLUE}20 0%, transparent 65%)`,
          pointerEvents: "none",
        }} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <p className="section-tag">Our Story & Beliefs</p>
          <h1 style={{
            fontFamily: "'Outfit', sans-serif", fontWeight: 900,
            fontSize: "clamp(48px, 8vw, 86px)",
            color: "white", lineHeight: 1.0, letterSpacing: "-2.5px", marginBottom: 24,
          }}>
            About 1AG Church
          </h1>
          <p style={{
            fontFamily: "'Outfit', sans-serif",
            color: "rgba(255,255,255,0.55)", fontSize: 19,
            fontWeight: 300, lineHeight: 1.75,
            maxWidth: 560, margin: "0 auto",
          }}>
            A century of faith, family, and community — rooted in Jerseyville, reaching the world.
          </p>
        </div>
      </div>

      {/* ——— OUR STORY ——— */}
      <section style={{ padding: "96px 40px", background: "white" }} className="content-pad">
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "center" }} className="grid-2">
          <div>
            <p className="section-tag">Our Story</p>
            <h2 style={{
              fontFamily: "'Outfit', sans-serif", fontWeight: 900,
              fontSize: "clamp(34px, 5vw, 52px)", lineHeight: 1.05,
              color: DARK, letterSpacing: "-1px", marginBottom: 28,
            }}>
              Born Out of<br />Revival in 1926
            </h2>
            <p style={{ fontFamily: "'Outfit', sans-serif", color: "#5a6370", fontSize: 17, lineHeight: 1.9, marginBottom: 20 }}>
              1AG Church was born in the fire of revival. In 1926, a movement of the Holy Spirit swept through Jerseyville, and out of that outpouring, our church was established — built on prayer, faith, and a deep hunger for God.
            </p>
            <p style={{ fontFamily: "'Outfit', sans-serif", color: "#5a6370", fontSize: 17, lineHeight: 1.9, marginBottom: 20 }}>
              A century later, that same Spirit is still moving. What began as a revival gathering has grown into a multigenerational community of believers committed to loving God, loving people, and making a lasting difference in Jerseyville and beyond.
            </p>
            <p style={{ fontFamily: "'Outfit', sans-serif", color: "#5a6370", fontSize: 17, lineHeight: 1.9 }}>
              We are part of the Assemblies of God — a fellowship of Spirit-filled churches that spans the globe — and we stay deeply rooted in our local community.
            </p>
          </div>

          {/* Timeline */}
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {[
              { year: "1926", label: "Founded", desc: "Born out of a Holy Spirit revival in Jerseyville, Illinois." },
              { year: "1960", label: "New Home", desc: `The church moved to its current location at ${settings.address.split(',')[0]}, planting deeper roots in the Jerseyville community.` },
              { year: "1996", label: "New Sanctuary", desc: "A new sanctuary was built, giving the church a permanent home to worship and grow together." },
              { year: "Today", label: "Still Moving", desc: "A thriving, multigenerational church reaching Jerseyville and the world." },
            ].map((item, i, arr) => (
              <div key={item.year} style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
                {/* Line + dot */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, width: 24 }}>
                  <div style={{ width: 14, height: 14, borderRadius: "50%", background: BLUE, flexShrink: 0, marginTop: 6, boxShadow: `0 0 0 4px ${BLUE}22` }} />
                  {i < arr.length - 1 && <div style={{ width: 2, flex: 1, background: `${BLUE}30`, minHeight: 48, marginTop: 4 }} />}
                </div>
                <div style={{ paddingBottom: i < arr.length - 1 ? 40 : 0 }}>
                  <p style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900, fontSize: 22, color: BLUE, lineHeight: 1, marginBottom: 4 }}>{item.year}</p>
                  <p style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 16, color: DARK, marginBottom: 6 }}>{item.label}</p>
                  <p style={{ fontFamily: "'Outfit', sans-serif", color: "#7a8490", fontSize: 14, lineHeight: 1.7 }}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ——— WHAT WE BELIEVE ——— */}
      <section style={{ padding: "96px 40px", background: "#F5F7FA" }} className="content-pad">
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <p className="section-tag">What We Believe</p>
            <h2 style={{
              fontFamily: "'Outfit', sans-serif", fontWeight: 900,
              fontSize: "clamp(34px, 5vw, 52px)", color: DARK,
              letterSpacing: "-1px", marginBottom: 16,
            }}>
              Our Core Beliefs
            </h2>
            <p style={{
              fontFamily: "'Outfit', sans-serif", color: "#7a8490",
              fontSize: 16, lineHeight: 1.8,
              maxWidth: 580, margin: "0 auto 56px",
            }}>
              As a member church of the <strong style={{ color: DARK }}>Assemblies of God</strong>, we hold to the 16 Fundamental Truths — a time-tested statement of biblical faith shared by millions of believers worldwide.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
            {BELIEFS.map((b, i) => (
              <div key={b.label} style={{
                background: "white",
                borderRadius: 10,
                padding: "24px 26px",
                border: "1px solid #eef0f3",
                display: "flex", gap: 16, alignItems: "flex-start",
                boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 6,
                  background: BLUE, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginTop: 2,
                }}>
                  <span style={{
                    fontFamily: "'Outfit', sans-serif",
                    fontWeight: 900, fontSize: 12,
                    color: "white", lineHeight: 1,
                  }}>{String(i + 1).padStart(2, "0")}</span>
                </div>
                <div>
                  <p style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 14, color: DARK, marginBottom: 5 }}>
                    {b.label}
                  </p>
                  <p style={{ fontFamily: "'Outfit', sans-serif", color: "#7a8490", fontSize: 13, lineHeight: 1.7 }}>
                    {b.text}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div style={{ textAlign: "center", marginTop: 40 }}>
            <a
              href="https://ag.org/beliefs/statement-of-fundamental-truths"
              target="_blank"
              rel="noreferrer"
              style={{
                fontFamily: "'Outfit', sans-serif",
                color: BLUE, fontWeight: 700, fontSize: 14,
                textDecoration: "underline", textUnderlineOffset: 3,
                cursor: "pointer",
              }}
            >
              Read the Full Assemblies of God Statement of Fundamental Truths →
            </a>
          </div>
        </div>
      </section>

      {/* ——— MEET THE STAFF ——— */}
      <section style={{ padding: "96px 40px", background: "white" }} className="content-pad">
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <p className="section-tag">The People Behind the Mission</p>
            <h2 style={{
              fontFamily: "'Outfit', sans-serif", fontWeight: 900,
              fontSize: "clamp(34px, 5vw, 52px)", color: DARK, letterSpacing: "-1px",
            }}>
              Meet Our Team
            </h2>
          </div>

          {staff.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px" }}>
              <p style={{ fontFamily: "'Outfit', sans-serif", color: "#aaa", fontSize: 16 }}>
                No staff members added yet. Add your team in the Admin dashboard.
              </p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 28 }}>
              {[...staff].sort((a, b) => (a.order || 0) - (b.order || 0)).map(member => (
                <div key={member.id} style={{
                  borderRadius: 12, overflow: "hidden",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.07)",
                  border: "1px solid #eef0f3",
                  background: "white",
                  transition: "transform 0.2s, box-shadow 0.2s",
                }}
                  onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-5px)"; e.currentTarget.style.boxShadow = `0 12px 40px ${BLUE}18`; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.07)"; }}
                >
                  {/* Photo */}
                  <div style={{
                    width: "100%", aspectRatio: "4/3",
                    background: `linear-gradient(145deg, ${DARK} 0%, #0d2232 100%)`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    overflow: "hidden", position: "relative",
                  }}>
                    {member.photoUrl ? (
                      <img
                        src={member.photoUrl}
                        alt={member.name}
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                      />
                    ) : (
                      <div style={{ textAlign: "center" }}>
                        <div style={{
                          width: 72, height: 72, borderRadius: "50%",
                          background: `${BLUE}44`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          margin: "0 auto 12px",
                        }}>
                          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={BLUE} strokeWidth="1.5" strokeLinecap="round">
                            <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                          </svg>
                        </div>
                        <p style={{ fontFamily: "'Outfit', sans-serif", color: "rgba(255,255,255,0.3)", fontSize: 12 }}>No photo</p>
                      </div>
                    )}
                    {/* Blue bottom accent */}
                    <div style={{
                      position: "absolute", bottom: 0, left: 0, right: 0,
                      height: 4, background: BLUE,
                    }} />
                  </div>

                  {/* Info */}
                  <div style={{ padding: "24px 26px 28px" }}>
                    <h3 style={{
                      fontFamily: "'Outfit', sans-serif", fontWeight: 900,
                      fontSize: 19, color: DARK, marginBottom: 4,
                    }}>
                      {member.name}
                    </h3>
                    <p style={{
                      fontFamily: "'Outfit', sans-serif", fontWeight: 700,
                      fontSize: 12, color: BLUE,
                      letterSpacing: "2px", textTransform: "uppercase",
                      marginBottom: 12,
                    }}>
                      {member.title}
                    </p>
                    {member.bio && (
                      <p style={{
                        fontFamily: "'Outfit', sans-serif", color: "#7a8490",
                        fontSize: 13, lineHeight: 1.75,
                      }}>
                        {member.bio}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ——— CTA ——— */}
      <section style={{
        padding: "88px 40px",
        background: `linear-gradient(135deg, ${BLUE} 0%, #0087ae 100%)`,
        textAlign: "center",
      }} className="content-pad">
        <p style={{ fontFamily: "'Outfit', sans-serif", color: "rgba(255,255,255,0.65)", fontSize: 11, letterSpacing: "4px", textTransform: "uppercase", marginBottom: 20 }}>
          Come As You Are
        </p>
        <h2 style={{
          fontFamily: "'Outfit', sans-serif", fontWeight: 900,
          fontSize: "clamp(34px, 5.5vw, 60px)",
          color: "white", lineHeight: 1.05, letterSpacing: "-1.5px", marginBottom: 20,
        }}>
          We'd Love to Meet You
        </h2>
        <p style={{ fontFamily: "'Outfit', sans-serif", color: "rgba(255,255,255,0.75)", fontSize: 17, marginBottom: 44, fontWeight: 300 }}>
          {`Join us this Sunday at ${settings.sundayTime} at ${settings.address}.`}
        </p>
        <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
          <button
            onClick={() => navigate("visit")}
            style={{
              background: "white", color: BLUE,
              border: "none", borderRadius: 5,
              padding: "17px 40px",
              fontFamily: "'Outfit', sans-serif",
              fontWeight: 900, fontSize: 14,
              cursor: "pointer", letterSpacing: "1px", textTransform: "uppercase",
              boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
              transition: "transform 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}
          >
            Plan Your Visit
          </button>
        </div>
      </section>

      <Footer navigate={navigate} settings={settings} />
    </div>
  );
}

// ——————————————————————————————————————————————————————————————————————————
// ADMIN LOGIN
// ——————————————————————————————————————————————————————————————————————————
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
const LOCKOUT_KEY = "1ag_login_lockout";

function getLoginLockout() {
  try {
    const raw = localStorage.getItem(LOCKOUT_KEY);
    if (!raw) return { attempts: 0, lockedUntil: null };
    return JSON.parse(raw);
  } catch (e) { return { attempts: 0, lockedUntil: null }; }
}

function setLoginLockout(data) {
  try { localStorage.setItem(LOCKOUT_KEY, JSON.stringify(data)); } catch (e) { }
}

function clearLoginLockout() {
  try { localStorage.removeItem(LOCKOUT_KEY); } catch (e) { }
}

function AdminLogin({ onLogin }) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [lockedUntil, setLockedUntil] = useState(() => {
    const { lockedUntil } = getLoginLockout();
    return lockedUntil && Date.now() < lockedUntil ? lockedUntil : null;
  });

  useEffect(() => {
    if (!lockedUntil) return;
    const remaining = lockedUntil - Date.now();
    if (remaining <= 0) { setLockedUntil(null); return; }
    const timer = setTimeout(() => setLockedUntil(null), remaining);
    return () => clearTimeout(timer);
  }, [lockedUntil]);

  const lockoutMinutes = lockedUntil ? Math.ceil((lockedUntil - Date.now()) / 60000) : 0;
  const isLocked = !!lockedUntil;
  const canSubmit = !isLocked && (supabase ? (!!email && !!pw) : !!pw);

  const recordFailure = () => {
    const lockout = getLoginLockout();
    const attempts = (lockout.attempts || 0) + 1;
    if (attempts >= MAX_ATTEMPTS) {
      const until = Date.now() + LOCKOUT_DURATION;
      setLoginLockout({ attempts, lockedUntil: until });
      setLockedUntil(until);
      setError(`Too many failed attempts. Try again in 15 minutes.`);
    } else {
      setLoginLockout({ attempts, lockedUntil: null });
      setError(`Incorrect email or password. ${MAX_ATTEMPTS - attempts} attempt${MAX_ATTEMPTS - attempts === 1 ? "" : "s"} remaining.`);
    }
  };

  const submit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError("");
    if (supabase) {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password: pw });
      if (authError) {
        recordFailure();
      } else {
        clearLoginLockout();
        onLogin();
      }
      setLoading(false);
    } else {
      setTimeout(() => {
        if (pw === ADMIN_PASS) {
          clearLoginLockout();
          try { window.storage && window.storage.set("1ag_admin_session", "true"); } catch (e) { }
          onLogin();
        } else {
          recordFailure();
        }
        setLoading(false);
      }, 600);
    }
  };

  return (
    <div style={{
      paddingTop: 72, minHeight: "100vh",
      background: `linear-gradient(145deg, ${DARK} 0%, #0d1e28 100%)`,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: "white", borderRadius: 14,
        padding: "52px 48px",
        maxWidth: 440, width: "100%", margin: "20px",
        boxShadow: "0 32px 80px rgba(0,0,0,0.4)",
      }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{
            width: 68, height: 68, borderRadius: "50%",
            background: BLUE,
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 20px",
            boxShadow: `0 8px 24px ${BLUE}44`,
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900, fontSize: 28, color: DARK }}>
            Staff Login
          </h2>
          <p style={{ fontFamily: "'Outfit', sans-serif", color: "#888", fontSize: 14, marginTop: 8 }}>
            1AG Church Content Management System
          </p>
        </div>

        {supabase && (
          <>
            <label className="label-text">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(""); }}
              onKeyDown={e => e.key === "Enter" && submit()}
              placeholder="admin@yourchurch.com"
              className="input-field"
              style={{ marginBottom: 24 }}
            />
          </>
        )}

        <label className="label-text">Password</label>
        <input
          type="password"
          value={pw}
          onChange={e => { setPw(e.target.value); setError(""); }}
          onKeyDown={e => e.key === "Enter" && submit()}
          placeholder="Enter admin password"
          className={`input-field ${error ? "error" : ""}`}
          style={{ marginBottom: error ? 8 : 28 }}
        />
        {error && (
          <p style={{
            fontFamily: "'Outfit', sans-serif", color: "#e55",
            fontSize: 13, marginBottom: 20,
          }}>{error}</p>
        )}

        <button
          onClick={submit}
          disabled={loading || !canSubmit}
          style={{
            width: "100%",
            background: loading || !canSubmit ? "#ccc" : BLUE,
            color: "white", border: "none", borderRadius: 6,
            padding: 16,
            fontFamily: "'Outfit', sans-serif",
            fontWeight: 800, fontSize: 15,
            letterSpacing: "1.5px", textTransform: "uppercase",
            cursor: loading || !canSubmit ? "not-allowed" : "pointer",
            transition: "background 0.2s",
          }}
        >
          {loading ? "Signing In..." : isLocked ? `Locked (${lockoutMinutes}m)` : "Sign In"}
        </button>

        <p style={{
          fontFamily: "'Outfit', sans-serif", color: "#ccc",
          fontSize: 12, textAlign: "center", marginTop: 20,
        }}>
          Contact your site administrator for access.
        </p>
      </div>
    </div>
  );
}

// ——————————————————————————————————————————————————————————————————————————
// ADMIN DASHBOARD
// ——————————————————————————————————————————————————————————————————————————
function AdminDashboard({ sermons, setSermons, staff, setStaff, settings, setSettings, onLogout }) {
  const [section, setSection] = useState("sermons"); // "sermons" | "staff"
  const [view, setView] = useState("list");
  const [editId, setEditId] = useState(null);
  const [toast, setToast] = useState("");
  const emptySermonForm = { title: "", speaker: "", date: "", series: "", youtubeUrl: "", description: "" };
  const emptyStaffForm = { name: "", title: "", bio: "", photoUrl: "", order: "" };
  const [form, setForm] = useState(emptySermonForm);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoUploadError, setPhotoUploadError] = useState("");
  const [saving, setSaving] = useState(false);
  const photoInputRef = useRef(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  };

  const extractId = (val = "") => {
    const match = val.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|live\/|watch\?v=|watch\?.+&v=))([^&?\/\s]{11})/);
    return match ? match[1] : val.trim();
  };

  const resetAndList = () => {
    setForm(section === "sermons" ? emptySermonForm : emptyStaffForm);
    setEditId(null);
    setView("list");
  };

  // â”€â”€ SERMON handlers â”€â”€
  const handleEditSermon = (s) => {
    setEditId(s.id);
    setForm({ title: s.title, speaker: s.speaker, date: s.date, series: s.series, youtubeUrl: s.youtubeId, description: s.description });
    setView("form");
    window.scrollTo({ top: 0 });
  };
  const handleDeleteSermon = (id) => {
    if (!window.confirm("Delete this sermon?")) return;
    setSermons(p => p.filter(s => s.id !== id));
    showToast("Sermon deleted.");
  };
  const handleSaveSermon = () => {
    if (!form.title.trim() || !form.youtubeUrl.trim()) { alert("Title and YouTube URL are required."); return; }
    const youtubeId = extractId(form.youtubeUrl);
    if (editId) {
      setSermons(p => p.map(s => s.id === editId ? { ...s, ...form, youtubeId } : s));
      showToast("✓ Sermon updated!");
    } else {
      setSermons(p => [{ ...form, id: Date.now().toString(), youtubeId }, ...p]);
      showToast("✓ Sermon added!");
    }
    resetAndList();
  };

  // â”€â”€ STAFF handlers â”€â”€
  const handleEditStaff = (m) => {
    setEditId(m.id);
    setForm({ name: m.name, title: m.title, bio: m.bio || "", photoUrl: m.photoUrl || "", order: m.order ?? "" });
    setView("form");
    window.scrollTo({ top: 0 });
  };
  const handleDeleteStaff = async (id) => {
    if (!window.confirm("Remove this staff member?")) return;
    const newStaff = staff.filter(m => m.id !== id);
    try {
      const result = await window.storage?.set(STAFF_KEY, JSON.stringify(newStaff));
      if (result) {
        setStaff(newStaff);
        showToast("Staff member removed.");
      } else {
        showToast("❌ Remove failed — please try again.");
      }
    } catch (e) {
      showToast("❌ Remove failed — please try again.");
    }
  };
  const handleSaveStaff = async () => {
    if (!form.name.trim() || !form.title.trim()) { alert("Name and title are required."); return; }
    const record = { ...form, order: parseInt(form.order) || 0 };
    const newStaff = editId
      ? staff.map(m => m.id === editId ? { ...m, ...record } : m)
      : [...staff, { ...record, id: Date.now().toString() }];
    setSaving(true);
    try {
      const result = await window.storage?.set(STAFF_KEY, JSON.stringify(newStaff));
      if (result) {
        setStaff(newStaff);
        showToast(editId ? "✓ Staff member saved!" : "✓ Team member added!");
        resetAndList();
      } else {
        showToast("❌ Save failed — please try again.");
      }
    } catch (e) {
      showToast("❌ Save failed — please try again.");
    } finally {
      setSaving(false);
    }
  };

  // —— SETTINGS handlers ——
  const [sForm, setSForm] = useState(settings);
  // Sync sForm whenever settings loads from Supabase (fixes async race condition)
  useEffect(() => { if (section === "settings") setSForm(settings); }, [settings]);
  // Sync sForm when settings tab is opened
  const handleOpenSettings = () => { setSForm(settings); setSection("settings"); setView("list"); setEditId(null); };
  const handleSaveSettings = () => {
    setSettings(sForm);
    showToast("✓ Settings saved!");
  };

  const [pwForm, setPwForm] = useState({ newPw: "", confirmPw: "" });
  const [pwError, setPwError] = useState("");
  const handleChangePassword = async () => {
    setPwError("");
    if (!pwForm.newPw) { setPwError("Please enter a new password."); return; }
    if (pwForm.newPw !== pwForm.confirmPw) { setPwError("Passwords don't match."); return; }
    if (pwForm.newPw.length < 6) { setPwError("Password must be at least 6 characters."); return; }
    const { error } = await supabase.auth.updateUser({ password: pwForm.newPw });
    if (error) {
      setPwError(error.message);
    } else {
      setPwForm({ newPw: "", confirmPw: "" });
      showToast("✓ Password updated!");
    }
  };

  const handlePhotoSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoUploadError("");
    // Show instant local preview
    const localUrl = URL.createObjectURL(file);
    setForm(p => ({ ...p, photoUrl: localUrl }));
    if (supabase) {
      setPhotoUploading(true);
      try {
        const publicUrl = await uploadStaffPhoto(file);
        setForm(p => ({ ...p, photoUrl: publicUrl }));
      } catch (err) {
        setPhotoUploadError("Upload failed. The photo preview is shown but won't save permanently. Please try again.");
        console.error(err);
      } finally {
        setPhotoUploading(false);
      }
    }
    // If no Supabase, keep localUrl (object URL) — note: won't persist across sessions,
    // so fall back to base64 for durability
    if (!supabase) {
      const reader = new FileReader();
      reader.onload = (ev) => setForm(p => ({ ...p, photoUrl: ev.target.result }));
      reader.readAsDataURL(file);
    }
  };

  const previewId = extractId(form.youtubeUrl || "");

  return (
    <div style={{ paddingTop: 72, minHeight: "100vh", background: "#F5F7FA" }}>

      {/* Admin Sub-Nav */}
      <div style={{ background: DARK, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 40px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56 }}>
          <div style={{ display: "flex", gap: 2 }}>
            {/* Section tabs */}
            {[
              { label: "🎬 Sermons", s: "sermons" },
              { label: "👥 Staff", s: "staff" },
              { label: "⚙️ Settings", s: "settings" },
            ].map(t => (
              <button
                key={t.s}
                onClick={() => { if (t.s === "settings") { handleOpenSettings(); } else { setSection(t.s); setView("list"); setEditId(null); setForm(t.s === "sermons" ? emptySermonForm : emptyStaffForm); } }}
                style={{
                  background: section === t.s ? "rgba(255,255,255,0.12)" : "transparent",
                  color: section === t.s ? "white" : "rgba(255,255,255,0.5)",
                  border: "none", padding: "8px 20px", borderRadius: 5,
                  fontFamily: "'Outfit', sans-serif",
                  fontWeight: section === t.s ? 700 : 400,
                  fontSize: 14, cursor: "pointer",
                  transition: "background 0.2s, color 0.2s",
                }}
              >{t.label}</button>
            ))}
            {/* View tabs */}
            <div style={{ width: 1, background: "rgba(255,255,255,0.12)", margin: "10px 8px" }} />
            {section === "sermons" && [
              { label: "Library", v: "list" },
              { label: "+ Add Sermon", v: "form" },
            ].map(t => (
              <button key={t.v}
                onClick={() => { if (t.v === "form") { setEditId(null); setForm(emptySermonForm); } setView(t.v); }}
                style={{
                  background: view === t.v ? BLUE : "transparent",
                  color: "white", border: "none",
                  padding: "8px 18px", borderRadius: 5,
                  fontFamily: "'Outfit', sans-serif",
                  fontWeight: view === t.v ? 700 : 400,
                  fontSize: 13, cursor: "pointer",
                  transition: "background 0.2s",
                }}
              >{t.label}</button>
            ))}
            {section === "staff" && [
              { label: "Team", v: "list" },
              { label: "+ Add Member", v: "form" },
            ].map(t => (
              <button key={t.v}
                onClick={() => { if (t.v === "form") { setEditId(null); setForm(emptyStaffForm); } setView(t.v); }}
                style={{
                  background: view === t.v ? BLUE : "transparent",
                  color: "white", border: "none",
                  padding: "8px 18px", borderRadius: 5,
                  fontFamily: "'Outfit', sans-serif",
                  fontWeight: view === t.v ? 700 : 400,
                  fontSize: 13, cursor: "pointer",
                  transition: "background 0.2s",
                }}
              >{t.label}</button>
            ))}
          </div>
          <button onClick={onLogout} style={{
            background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)",
            border: "none", borderRadius: 5, padding: "8px 20px",
            fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: 13, cursor: "pointer",
          }}>Sign Out</button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 140, left: "50%", transform: "translateX(-50%)",
          background: DARK, color: "white",
          padding: "14px 28px", borderRadius: 8,
          fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: 15,
          zIndex: 5000, boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
          border: `2px solid ${BLUE}`,
          animation: "fadeSlideUp 0.3s ease",
        }}>{toast}</div>
      )}

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 40px" }} className="content-pad">

        {/* ══════════ SERMONS ══════════ */}
        {section === "sermons" && view === "list" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32, flexWrap: "wrap", gap: 16 }}>
              <div>
                <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900, fontSize: 32, color: DARK }}>Sermon Library</h2>
                <p style={{ fontFamily: "'Outfit', sans-serif", color: "#888", fontSize: 15 }}>{sermons.length} sermon{sermons.length !== 1 ? "s" : ""} in archive</p>
              </div>
              <button className="btn-primary" onClick={() => { setEditId(null); setForm(emptySermonForm); setView("form"); }}>+ Add New Sermon</button>
            </div>
            <div style={{ background: "white", borderRadius: 12, overflow: "hidden", boxShadow: "0 2px 16px rgba(0,0,0,0.06)" }}>
              {sermons.length === 0 ? (
                <div style={{ padding: "80px 40px", textAlign: "center" }}>
                  <span style={{ fontSize: 48, display: "block", marginBottom: 16 }}>🎬</span>
                  <p style={{ fontFamily: "'Outfit', sans-serif", color: "#888", fontSize: 18, marginBottom: 24 }}>No sermons yet.</p>
                  <button className="btn-primary" onClick={() => setView("form")}>Add Sermon</button>
                </div>
              ) : sermons.map((s, i) => {
                const ytId = extractId(s.youtubeId);
                return (
                  <div key={s.id} style={{ padding: "20px 28px", display: "flex", alignItems: "center", gap: 20, borderBottom: i < sermons.length - 1 ? "1px solid #f3f3f3" : "none" }}>
                    <div style={{ width: 110, height: 62, borderRadius: 6, overflow: "hidden", background: DARK, flexShrink: 0, position: "relative" }}>
                      <img src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" data-fallbacks={JSON.stringify([`https://img.youtube.com/vi/${ytId}/sddefault.jpg`,`https://img.youtube.com/vi/${ytId}/default.jpg`])} onError={e => { const f = JSON.parse(e.target.dataset.fallbacks || "[]"); if (f.length > 0) { e.target.src = f.shift(); e.target.dataset.fallbacks = JSON.stringify(f); } else { e.target.style.display = "none"; } }} />
                      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.2)" }}>
                        <svg width="16" height="16" viewBox="0 0 20 20" fill="white"><polygon points="7,3 18,10 7,17" /></svg>
                      </div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 16, color: DARK, marginBottom: 5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.title}</h4>
                      <p style={{ fontFamily: "'Outfit', sans-serif", color: "#888", fontSize: 13 }}>{s.speaker}{s.series ? ` · ${s.series}` : ""}{s.date ? ` · ${new Date(s.date).toLocaleDateString()}` : ""}</p>
                    </div>
                    <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
                      <a href={`https://youtube.com/watch?v=${ytId}`} target="_blank" rel="noreferrer" style={{ background: "#f5f5f5", color: "#555", border: "none", borderRadius: 5, padding: "9px 16px", fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: 13, textDecoration: "none" }}>▶ View</a>
                      <button onClick={() => handleEditSermon(s)} style={{ background: `${BLUE}18`, color: BLUE, border: `1px solid ${BLUE}40`, borderRadius: 5, padding: "9px 16px", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Edit</button>
                      <button onClick={() => handleDeleteSermon(s.id)} style={{ background: "#ffe8e8", color: "#c00", border: "1px solid #f5c6c6", borderRadius: 5, padding: "9px 16px", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Delete</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {section === "sermons" && view === "form" && (
          <div style={{ maxWidth: 740 }}>
            <div style={{ marginBottom: 36 }}>
              <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900, fontSize: 32, color: DARK }}>{editId ? "Edit Sermon" : "Add New Sermon"}</h2>
              <p style={{ fontFamily: "'Outfit', sans-serif", color: "#888", fontSize: 15, marginTop: 6 }}>Paste a YouTube link and fill in the details.</p>
            </div>
            <div style={{ background: "white", borderRadius: 12, padding: "40px", boxShadow: "0 2px 16px rgba(0,0,0,0.06)" }}>
              <label className="label-text">YouTube URL, Embed Code, or Video ID *</label>
              <input value={form.youtubeUrl || ""} onChange={e => setForm(p => ({ ...p, youtubeUrl: e.target.value }))} placeholder="URL, embed code, or video ID — all work" className="input-field" style={{ marginBottom: 8 }} />
              <p style={{ fontFamily: "'Outfit', sans-serif", color: "#aaa", fontSize: 12, marginBottom: 28 }}>Paste a YouTube URL, the full &lt;iframe&gt; embed code, or just the video ID</p>
              {form.youtubeUrl && previewId && previewId.length >= 8 && (
                <div style={{ marginBottom: 32 }}>
                  <label className="label-text" style={{ marginBottom: 12 }}>Video Preview</label>
                  <div style={{ borderRadius: 8, overflow: "hidden", aspectRatio: "16/9", background: DARK }}>
                    <iframe key={previewId} src={`https://www.youtube.com/embed/${previewId}`} title="Preview" frameBorder="0" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen style={{ width: "100%", height: "100%", display: "block" }} />
                  </div>
                </div>
              )}
              <div className="admin-form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 24px" }}>
                <div><label className="label-text">Sermon Title *</label><input value={form.title || ""} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g., Walking in Faith" className="input-field" style={{ marginBottom: 24 }} /></div>
                <div><label className="label-text">Speaker</label><input value={form.speaker || ""} onChange={e => setForm(p => ({ ...p, speaker: e.target.value }))} placeholder="e.g., Pastor James Williams" className="input-field" style={{ marginBottom: 24 }} /></div>
                <div><label className="label-text">Series Name</label><input value={form.series || ""} onChange={e => setForm(p => ({ ...p, series: e.target.value }))} placeholder="e.g., Faith Foundations" className="input-field" style={{ marginBottom: 24 }} /></div>
                <div><label className="label-text">Date</label><input type="date" value={form.date || ""} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} className="input-field" style={{ marginBottom: 24 }} /></div>
              </div>
              <label className="label-text">Description</label>
              <textarea value={form.description || ""} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="A brief description..." className="input-field" style={{ height: 110, resize: "vertical", marginBottom: 32 }} />
              <div style={{ display: "flex", gap: 14 }}>
                <button className="btn-primary" onClick={handleSaveSermon}>{editId ? "Save Changes" : "Add to Archive"}</button>
                <button onClick={resetAndList} style={{ background: "#f3f3f3", color: "#555", border: "none", borderRadius: 5, padding: "14px 24px", fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* ══════════ STAFF ══════════ */}
        {section === "staff" && view === "list" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32, flexWrap: "wrap", gap: 16 }}>
              <div>
                <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900, fontSize: 32, color: DARK }}>Staff Manager</h2>
                <p style={{ fontFamily: "'Outfit', sans-serif", color: "#888", fontSize: 15 }}>{staff.length} team member{staff.length !== 1 ? "s" : ""} · drag to reorder using the Order field</p>
              </div>
              <button className="btn-primary" onClick={() => { setEditId(null); setForm(emptyStaffForm); setView("form"); }}>+ Add Team Member</button>
            </div>
            <div style={{ background: "white", borderRadius: 12, overflow: "hidden", boxShadow: "0 2px 16px rgba(0,0,0,0.06)" }}>
              {staff.length === 0 ? (
                <div style={{ padding: "80px 40px", textAlign: "center" }}>
                  <span style={{ fontSize: 48, display: "block", marginBottom: 16 }}>👥</span>
                  <p style={{ fontFamily: "'Outfit', sans-serif", color: "#888", fontSize: 18, marginBottom: 24 }}>No staff members yet.</p>
                  <button className="btn-primary" onClick={() => setView("form")}>Add First Member</button>
                </div>
              ) : [...staff].sort((a, b) => (a.order || 0) - (b.order || 0)).map((m, i, arr) => (
                <div key={m.id} style={{ padding: "18px 28px", display: "flex", alignItems: "center", gap: 20, borderBottom: i < arr.length - 1 ? "1px solid #f3f3f3" : "none" }}>
                  {/* Photo thumb */}
                  <div style={{ width: 52, height: 52, borderRadius: "50%", overflow: "hidden", background: `linear-gradient(135deg, ${DARK}, #0d2232)`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {m.photoUrl
                      ? <img src={m.photoUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
                      : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={BLUE} strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" /></svg>
                    }
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h4 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 16, color: DARK, marginBottom: 3 }}>{m.name}</h4>
                    <p style={{ fontFamily: "'Outfit', sans-serif", color: BLUE, fontSize: 12, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase" }}>{m.title}</p>
                  </div>
                  <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
                    <button onClick={() => handleEditStaff(m)} style={{ background: `${BLUE}18`, color: BLUE, border: `1px solid ${BLUE}40`, borderRadius: 5, padding: "9px 16px", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Edit</button>
                    <button onClick={() => handleDeleteStaff(m.id)} style={{ background: "#ffe8e8", color: "#c00", border: "1px solid #f5c6c6", borderRadius: 5, padding: "9px 16px", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Remove</button>
                  </div>
                </div>
              ))}
            </div>
            <p style={{ fontFamily: "'Outfit', sans-serif", color: "#aaa", fontSize: 13, marginTop: 16 }}>
              💡 Staff appear on the About page sorted by their Order number (lowest first). Set Order to 0 for Lead Pastor, 1 for next, etc.
            </p>
          </div>
        )}

        {section === "staff" && view === "form" && (
          <div style={{ maxWidth: 640 }}>
            <div style={{ marginBottom: 36 }}>
              <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900, fontSize: 32, color: DARK }}>{editId ? "Edit Team Member" : "Add Team Member"}</h2>
              <p style={{ fontFamily: "'Outfit', sans-serif", color: "#888", fontSize: 15, marginTop: 6 }}>Fill in the details below. Upload a photo directly from your device.</p>
            </div>
            <div style={{ background: "white", borderRadius: 12, padding: "40px", boxShadow: "0 2px 16px rgba(0,0,0,0.06)" }}>
              {/* Photo upload section */}
              <div style={{ marginBottom: 28 }}>
                <label className="label-text">Photo</label>
                <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 8 }}>
                  {/* Photo preview circle */}
                  <div style={{ width: 80, height: 80, borderRadius: "50%", overflow: "hidden", background: "#eee", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {form.photoUrl ? (
                      <img src={form.photoUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="Preview" onError={e => { e.target.style.display = "none"; }} />
                    ) : (
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" /></svg>
                    )}
                  </div>
                  <div>
                    {/* Hidden file input */}
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={handlePhotoSelect}
                    />
                    <button
                      type="button"
                      onClick={() => { setPhotoUploadError(""); photoInputRef.current && photoInputRef.current.click(); }}
                      disabled={photoUploading}
                      style={{ background: form.photoUrl ? "#f3f3f3" : BLUE, color: form.photoUrl ? "#555" : "white", border: "none", borderRadius: 6, padding: "10px 20px", fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: 14, cursor: photoUploading ? "not-allowed" : "pointer", opacity: photoUploading ? 0.7 : 1 }}
                    >
                      {photoUploading ? "Uploading…" : form.photoUrl ? "Change Photo" : "Upload Photo"}
                    </button>
                    {form.photoUrl && !photoUploading && (
                      <button
                        type="button"
                        onClick={() => setForm(p => ({ ...p, photoUrl: "" }))}
                        style={{ marginLeft: 10, background: "none", border: "none", color: "#aaa", fontSize: 13, cursor: "pointer", fontFamily: "'Outfit', sans-serif" }}
                      >
                        Remove
                      </button>
                    )}
                    {photoUploading && (
                      <p style={{ fontFamily: "'Outfit', sans-serif", color: BLUE, fontSize: 13, marginTop: 6 }}>Uploading photo…</p>
                    )}
                    {photoUploadError && (
                      <p style={{ fontFamily: "'Outfit', sans-serif", color: "#e05", fontSize: 12, marginTop: 6 }}>{photoUploadError}</p>
                    )}
                    {!photoUploading && !photoUploadError && (
                      <p style={{ fontFamily: "'Outfit', sans-serif", color: "#aaa", fontSize: 12, marginTop: 6 }}>JPG or PNG, any size</p>
                    )}
                  </div>
                </div>
              </div>
              <div className="admin-form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 24px" }}>
                <div><label className="label-text">Full Name *</label><input value={form.name || ""} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g., Pastor John Smith" className="input-field" style={{ marginBottom: 24 }} /></div>
                <div><label className="label-text">Title / Role *</label><input value={form.title || ""} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g., Lead Pastor" className="input-field" style={{ marginBottom: 24 }} /></div>
              </div>
              <label className="label-text">Bio</label>
              <textarea value={form.bio || ""} onChange={e => setForm(p => ({ ...p, bio: e.target.value }))} placeholder="A short bio — a sentence or two about this team member..." className="input-field" style={{ height: 100, resize: "vertical", marginBottom: 24 }} />
              <label className="label-text">Display Order</label>
              <input type="number" value={form.order || ""} onChange={e => setForm(p => ({ ...p, order: e.target.value }))} placeholder="0 = first, 1 = second, etc." className="input-field" style={{ marginBottom: 32 }} />
              <div style={{ display: "flex", gap: 14 }}>
                <button className="btn-primary" onClick={handleSaveStaff} disabled={saving} style={{ opacity: saving ? 0.7 : 1, cursor: saving ? "not-allowed" : "pointer" }}>{saving ? "Saving…" : editId ? "Save Changes" : "Add to Team"}</button>
                <button onClick={resetAndList} style={{ background: "#f3f3f3", color: "#555", border: "none", borderRadius: 5, padding: "14px 24px", fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* ══════════ SETTINGS ══════════ */}
        {section === "settings" && (
          <div style={{ maxWidth: 640 }}>
            <div style={{ marginBottom: 36 }}>
              <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900, fontSize: 32, color: DARK }}>Church Settings</h2>
              <p style={{ fontFamily: "'Outfit', sans-serif", color: "#888", fontSize: 15, marginTop: 6 }}>These values appear throughout the website. Changes are saved to Supabase and go live immediately.</p>
            </div>

            {/* Contact Information */}
            <div style={{ background: "white", borderRadius: 12, padding: "36px 40px", boxShadow: "0 2px 16px rgba(0,0,0,0.06)", marginBottom: 24 }}>
              <h3 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 18, color: DARK, marginBottom: 24, paddingBottom: 16, borderBottom: "1px solid #eef0f3" }}>Contact Information</h3>
              <div className="admin-form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 24px" }}>
                <div>
                  <label className="label-text">Church Name</label>
                  <input value={sForm.churchName || ""} onChange={e => setSForm(p => ({ ...p, churchName: e.target.value }))} placeholder="e.g., 1AG Church" className="input-field" style={{ marginBottom: 24 }} />
                </div>
                <div>
                  <label className="label-text">Email</label>
                  <input value={sForm.email || ""} onChange={e => setSForm(p => ({ ...p, email: e.target.value }))} placeholder="info@yourchurch.com" className="input-field" style={{ marginBottom: 24 }} />
                </div>
              </div>
              <label className="label-text">Address</label>
              <input value={sForm.address || ""} onChange={e => setSForm(p => ({ ...p, address: e.target.value }))} placeholder="123 Church St, City, State ZIP" className="input-field" style={{ marginBottom: 24 }} />
              <label className="label-text">Phone</label>
              <input value={sForm.phone || ""} onChange={e => setSForm(p => ({ ...p, phone: e.target.value }))} placeholder="618.555.1234" className="input-field" style={{ marginBottom: 0 }} />
            </div>

            {/* Service Times */}
            <div style={{ background: "white", borderRadius: 12, padding: "36px 40px", boxShadow: "0 2px 16px rgba(0,0,0,0.06)", marginBottom: 24 }}>
              <h3 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 18, color: DARK, marginBottom: 24, paddingBottom: 16, borderBottom: "1px solid #eef0f3" }}>Service Times</h3>
              <div className="admin-form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 24px" }}>
                <div>
                  <label className="label-text">Sunday Service Time</label>
                  <input value={sForm.sundayTime || ""} onChange={e => setSForm(p => ({ ...p, sundayTime: e.target.value }))} placeholder="e.g., 10:00 AM" className="input-field" style={{ marginBottom: 0 }} />
                </div>
                <div>
                  <label className="label-text">Youth / Evening Service Time</label>
                  <input value={sForm.youthTime || ""} onChange={e => setSForm(p => ({ ...p, youthTime: e.target.value }))} placeholder="e.g., 5:00 PM" className="input-field" style={{ marginBottom: 0 }} />
                </div>
              </div>
            </div>

            {/* Links & URLs */}
            <div style={{ background: "white", borderRadius: 12, padding: "36px 40px", boxShadow: "0 2px 16px rgba(0,0,0,0.06)", marginBottom: 24 }}>
              <h3 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 18, color: DARK, marginBottom: 24, paddingBottom: 16, borderBottom: "1px solid #eef0f3" }}>Links & URLs</h3>
              <label className="label-text">Giving URL</label>
              <input value={sForm.givingUrl || ""} onChange={e => setSForm(p => ({ ...p, givingUrl: e.target.value }))} placeholder="https://give.tithe.ly/..." className="input-field" style={{ marginBottom: 8 }} />
              <p style={{ fontFamily: "'Outfit', sans-serif", color: "#aaa", fontSize: 12, marginBottom: 24 }}>The URL your Give button links to. Tithe.ly, Pushpay, PayPal, etc.</p>
              <label className="label-text">Watch Live URL</label>
              <input value={sForm.watchLiveUrl || ""} onChange={e => setSForm(p => ({ ...p, watchLiveUrl: e.target.value }))} placeholder="https://yourchurch.online.church" className="input-field" style={{ marginBottom: 8 }} />
              <p style={{ fontFamily: "'Outfit', sans-serif", color: "#aaa", fontSize: 12, marginBottom: 0 }}>The URL your "Watch Live" button links to.</p>
            </div>

            {/* Social Media */}
            <div style={{ background: "white", borderRadius: 12, padding: "36px 40px", boxShadow: "0 2px 16px rgba(0,0,0,0.06)", marginBottom: 32 }}>
              <h3 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 18, color: DARK, marginBottom: 24, paddingBottom: 16, borderBottom: "1px solid #eef0f3" }}>Social Media</h3>
              <label className="label-text">Facebook URL</label>
              <input value={sForm.facebookUrl || ""} onChange={e => setSForm(p => ({ ...p, facebookUrl: e.target.value }))} placeholder="https://facebook.com/yourchurch" className="input-field" style={{ marginBottom: 24 }} />
              <label className="label-text">Instagram URL</label>
              <input value={sForm.instagramUrl || ""} onChange={e => setSForm(p => ({ ...p, instagramUrl: e.target.value }))} placeholder="https://instagram.com/yourchurch" className="input-field" style={{ marginBottom: 24 }} />
              <label className="label-text">YouTube Channel URL</label>
              <input value={sForm.youtubeUrl || ""} onChange={e => setSForm(p => ({ ...p, youtubeUrl: e.target.value }))} placeholder="https://youtube.com/@yourchurch" className="input-field" style={{ marginBottom: 0 }} />
            </div>

            {/* Google Calendar */}
            <div style={{ background: "white", borderRadius: 12, padding: "36px 40px", boxShadow: "0 2px 16px rgba(0,0,0,0.06)", marginBottom: 32 }}>
              <h3 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 18, color: DARK, marginBottom: 8, paddingBottom: 16, borderBottom: "1px solid #eef0f3" }}>Google Calendar <span style={{ fontSize: 13, fontWeight: 400, color: "#aaa" }}>(optional)</span></h3>
              <p style={{ fontFamily: "'Outfit', sans-serif", color: "#888", fontSize: 13, marginBottom: 24, lineHeight: 1.6 }}>
                In Google Calendar → ⋮ menu → Settings and sharing → Integrate calendar → copy the <strong>Calendar ID</strong>. For the API Key, go to <strong>console.cloud.google.com</strong>, enable the Google Calendar API, and create a key.
              </p>
              <label className="label-text">Calendar ID</label>
              <input value={sForm.calendarId || ""} onChange={e => setSForm(p => ({ ...p, calendarId: e.target.value }))} placeholder="yourchurch@group.calendar.google.com" className="input-field" style={{ marginBottom: 24 }} />
              <label className="label-text">Google API Key</label>
              <input value={sForm.calendarKey || ""} onChange={e => setSForm(p => ({ ...p, calendarKey: e.target.value }))} placeholder="AIzaSy..." className="input-field" style={{ marginBottom: 0 }} />
            </div>

            <button className="btn-primary" onClick={handleSaveSettings} style={{ fontSize: 16, padding: "16px 40px" }}>Save Settings</button>

            {supabase && (
              <div style={{ background: "white", borderRadius: 12, padding: "36px 40px", boxShadow: "0 2px 16px rgba(0,0,0,0.06)", marginTop: 32 }}>
                <h3 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 18, color: DARK, marginBottom: 24, paddingBottom: 16, borderBottom: "1px solid #eef0f3" }}>
                  Change Admin Password
                </h3>
                <label className="label-text">New Password</label>
                <input
                  type="password"
                  value={pwForm.newPw}
                  onChange={e => { setPwForm(p => ({ ...p, newPw: e.target.value })); setPwError(""); }}
                  placeholder="New password (min. 6 characters)"
                  className="input-field"
                  style={{ marginBottom: 24 }}
                />
                <label className="label-text">Confirm New Password</label>
                <input
                  type="password"
                  value={pwForm.confirmPw}
                  onChange={e => { setPwForm(p => ({ ...p, confirmPw: e.target.value })); setPwError(""); }}
                  placeholder="Confirm new password"
                  className={`input-field ${pwError ? "error" : ""}`}
                  style={{ marginBottom: pwError ? 8 : 24 }}
                />
                {pwError && <p style={{ fontFamily: "'Outfit', sans-serif", color: "#e55", fontSize: 13, marginBottom: 20 }}>{pwError}</p>}
                <button className="btn-primary" onClick={handleChangePassword}>Update Password</button>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ROOT APP
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function App() {
  const [page, setPage] = useState(() =>
    window.location.hash.replace("#", "") || "home"
  );
  const [isAdmin, setIsAdmin] = useState(false);
  const [sermons, setSermons] = useState(DEFAULT_SERMONS);
  const [staff, setStaff] = useState(DEFAULT_STAFF);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [dataLoaded, setDataLoaded] = useState(false);

  useEffect(() => {
    const handleHash = () => {
      const valid = ["home", "about", "sermons", "calendar", "visit", "admin"];
      const raw = window.location.hash.replace("#", "") || "home";
      const p = valid.includes(raw) ? raw : "home";
      setPage(p);
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

  // Save effects — only fire AFTER data has been loaded from Supabase
  // Staff saves are handled explicitly in handleSaveStaff / handleDeleteStaff with real error feedback
  useEffect(() => { if (!dataLoaded) return; try { window.storage && window.storage.set(STORAGE_KEY, JSON.stringify(sermons)); } catch (e) { } }, [sermons, dataLoaded]);
  useEffect(() => { if (!dataLoaded) return; try { window.storage && window.storage.set(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { } }, [settings, dataLoaded]);

  // Load persisted data
  useEffect(() => {
    const load = async () => {
      try {
        if (!window.storage) { setDataLoaded(true); return; }
        const [sd, std, stg] = await Promise.all([
          window.storage.get(STORAGE_KEY).catch(() => null),
          window.storage.get(STAFF_KEY).catch(() => null),
          window.storage.get(SETTINGS_KEY).catch(() => null),
        ]);
        if (sd?.value) try { const loaded = JSON.parse(sd.value); setSermons(loaded.filter(s => s.youtubeId && !s.youtubeId.startsWith("VIDEO_ID_"))); } catch (e) { }
        if (std?.value) try { setStaff(JSON.parse(std.value)); } catch (e) { }
        if (stg?.value) try {
          const saved = JSON.parse(stg.value);
          // Merge saved settings but don't overwrite DEFAULT_SETTINGS values with empty strings
          const merged = { ...DEFAULT_SETTINGS };
          Object.keys(saved).forEach(k => { if (saved[k] !== "" && saved[k] !== null && saved[k] !== undefined) merged[k] = saved[k]; });
          setSettings(merged);
        } catch (e) { }
      } catch (e) { }
      setDataLoaded(true);
    };
    load();
  }, []);

  useEffect(() => {
    if (!supabase) {
      const checkLegacy = async () => {
        try {
          const ad = await window.storage?.get("1ag_admin_session").catch(() => null);
          if (ad?.value === "true") setIsAdmin(true);
        } catch (e) { }
      };
      checkLegacy();
      return;
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setIsAdmin(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAdmin(!!session);
    });
    return () => subscription.unsubscribe();
  }, []);

  const navigate = (p) => { window.location.hash = p; };

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    } else {
      try { window.storage && window.storage.delete("1ag_admin_session"); } catch (e) { }
    }
    setIsAdmin(false);
    navigate("home");
  };

  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
      <Navbar page={page} navigate={navigate} isAdminLoggedIn={isAdmin} settings={settings} />
      {page === "home" && <HomePage sermons={sermons} navigate={navigate} settings={settings} />}
      {page === "about" && <AboutPage staff={staff} navigate={navigate} settings={settings} />}
      {page === "sermons" && <SermonsPage sermons={sermons} navigate={navigate} settings={settings} />}
      {page === "calendar" && <CalendarPage navigate={navigate} settings={settings} />}
      {page === "visit" && <PlanVisitPage navigate={navigate} settings={settings} />}
      {page === "admin" && (
        isAdmin
          ? <AdminDashboard sermons={sermons} setSermons={setSermons} staff={staff} setStaff={setStaff} settings={settings} setSettings={setSettings} onLogout={handleLogout} />
          : <AdminLogin onLogin={() => setIsAdmin(true)} />
      )}
    </div>
  );
}
