#!/usr/bin/env node
/**
 * Apply Mirantic's Auth0 configuration: invite-only sign-in and a branded
 * Universal Login page. Idempotent — safe to re-run after tweaking THEME below.
 *
 *   node scripts/auth0-setup.mjs [--dry-run]
 *
 * Reads AUTH0_DOMAIN and the M2M credentials from .env.local. The M2M app needs:
 *   read:connections update:connections update:connections_options
 *   read:branding update:branding
 *   read:branding_themes create:branding_themes update:branding_themes
 *   read:prompts update:prompts
 * Each step reports independently, so a missing scope fails only that step.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DRY = process.argv.includes("--dry-run");

// ── Mirantic brand ────────────────────────────────────────────────────────────
// Slate blue on deep navy: the marketing site's accent, inverted for a login
// card that reads as premium rather than default-Auth0.
const BRAND = {
  primary: "#4A6FA5",        // buttons, links, focus rings
  pageBackground: "#0E1626", // behind the card
  widgetBackground: "#16233A",
  bodyText: "#E6EAF2",
  headerText: "#FFFFFF",
  inputBackground: "#1E2E4A",
  inputBorder: "#31456B",
  // Reversed (white) wordmark, cropped to its ink box — logo-primary is dark
  // artwork and logo-reversed.png carries ~90% empty canvas that Auth0 would
  // scale the wordmark away inside.
  logoUrl: "https://mirantic.com/brand/logo-reversed-trimmed.png",
  fontUrl: "https://fonts.gstatic.com/s/hankengrotesk/v8/ieVq2YZDLWuGJpnzaiwFXS9tYvBRzyFLlZg_f-NGoZE.woff2",
};

const CONNECTION = "Username-Password-Authentication";

function env() {
  const out = {};
  const file = path.join(ROOT, ".env.local");
  if (!fs.existsSync(file)) throw new Error(`missing ${file}`);
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

const E = env();
const DOMAIN = E.AUTH0_DOMAIN;
if (!DOMAIN) throw new Error("AUTH0_DOMAIN missing from .env.local");

async function token() {
  const res = await fetch(`https://${DOMAIN}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: E.AUTH0_M2M_CLIENT_ID,
      client_secret: E.AUTH0_M2M_CLIENT_SECRET,
      audience: `https://${DOMAIN}/api/v2/`,
    }),
  });
  if (!res.ok) throw new Error(`token request failed: ${res.status} ${await res.text()}`);
  return (await res.json()).access_token;
}

const TOKEN = await token();

async function api(method, route, body) {
  const res = await fetch(`https://${DOMAIN}/api/v2${route}`, {
    method,
    headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = new Error(json?.message || `${res.status} ${text.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  return json;
}

const results = [];
async function step(label, fn) {
  if (DRY) return results.push([label, "skipped (dry run)"]);
  try {
    await fn();
    results.push([label, "ok"]);
  } catch (err) {
    const scope = err.status === 403 || /scope/i.test(err.message) ? " — missing Management API scope" : "";
    results.push([label, `FAILED: ${err.message}${scope}`]);
  }
}

// 1. Invite only: no public sign-up, and no "Sign up" link on the login page.
await step("disable public sign-up", async () => {
  const conns = await api("GET", `/connections?name=${encodeURIComponent(CONNECTION)}`);
  const conn = conns?.[0];
  if (!conn) throw new Error(`connection ${CONNECTION} not found`);
  await api("PATCH", `/connections/${conn.id}`, {
    options: { ...conn.options, disable_signup: true },
  });
});

// 2. Logo and primary colours (the classic branding surface).
await step("branding: logo + colours", () =>
  api("PATCH", "/branding", {
    logo_url: BRAND.logoUrl,
    colors: { primary: BRAND.primary, page_background: BRAND.pageBackground },
    font: { url: BRAND.fontUrl },
  })
);

// 3. The theme is what actually makes the page look designed rather than default.
await step("branding theme", async () => {
  const theme = {
    borders: {
      button_border_radius: 8, button_border_weight: 1, buttons_style: "rounded",
      input_border_radius: 8, input_border_weight: 1, inputs_style: "rounded",
      show_widget_shadow: true, widget_border_weight: 1, widget_corner_radius: 14,
    },
    colors: {
      base_focus_color: BRAND.primary,
      base_hover_color: BRAND.primary,
      body_text: BRAND.bodyText,
      captcha_widget_theme: "dark",
      error: "#E5484D",
      header: BRAND.headerText,
      icons: BRAND.primary,
      input_background: BRAND.inputBackground,
      input_border: BRAND.inputBorder,
      input_filled_text: BRAND.bodyText,
      input_labels_placeholders: "#93A3C0",
      links_focused_components: BRAND.primary,
      primary_button: BRAND.primary,
      primary_button_label: "#FFFFFF",
      secondary_button_border: BRAND.inputBorder,
      secondary_button_label: BRAND.bodyText,
      success: "#2FA84F",
      widget_background: BRAND.widgetBackground,
      widget_border: BRAND.inputBorder,
    },
    fonts: {
      body_text: { bold: false, size: 87.5 },
      buttons_text: { bold: false, size: 100 },
      font_url: BRAND.fontUrl,
      input_labels: { bold: false, size: 100 },
      links: { bold: true, size: 87.5 },
      links_style: "normal",
      reference_text_size: 16,
      subtitle: { bold: false, size: 87.5 },
      title: { bold: true, size: 150 },
    },
    page_background: {
      background_color: BRAND.pageBackground,
      background_image_url: "",
      page_layout: "center",
    },
    widget: {
      header_text_alignment: "center",
      logo_height: 32,
      logo_position: "center",
      logo_url: BRAND.logoUrl,
      social_buttons_layout: "bottom",
    },
  };
  try {
    const existing = await api("GET", "/branding/themes/default");
    await api("PATCH", `/branding/themes/${existing.themeId}`, theme);
  } catch (err) {
    if (err.status !== 404) throw err;
    await api("POST", "/branding/themes", theme);
  }
});

// 4. Wording: Auth0's default names the raw tenant ("dev-0t8zql66uhyw4hkr").
await step("login page text", () =>
  api("PUT", "/prompts/login/custom-text/en", {
    login: {
      title: "Welcome",
      description: "Sign in to manage your website content.",
      buttonText: "Continue",
      footerText: "",
    },
  })
);

console.log(DRY ? "\nDRY RUN — nothing was changed\n" : "");
for (const [label, status] of results) {
  const mark = status === "ok" ? "  ok  " : status.startsWith("FAILED") ? "  !!  " : "  --  ";
  console.log(`${mark} ${label}${status === "ok" ? "" : `  ${status}`}`);
}
const failed = results.filter(([, s]) => s.startsWith("FAILED"));
process.exit(failed.length ? 1 : 0);
