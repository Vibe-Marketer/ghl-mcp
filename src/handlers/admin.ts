/**
 * Admin Panel — Internal SaaS-style management dashboard
 */

import type { Env, User, SubAccount } from "../types";
import { initUsersDb, getAllUsers, updateUser, deleteUser, createUserByAdmin } from "../db/users";
import { initDb } from "../db/accounts";
import { checkRateLimit, getClientIp, rateLimitResponse } from "../utils/rate-limit";

// CRIT-3 fix: restrict admin CORS to same-origin only
function getAdminCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("Origin") ?? "";
  const url = new URL(request.url);
  const selfOrigin = url.origin;
  // Only allow same-origin requests to admin APIs
  const allowedOrigin = origin === selfOrigin ? selfOrigin : "null";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Cookie",
    "Access-Control-Allow-Credentials": "true",
    "Vary": "Origin",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
  };
}

// Keep a static version for non-request contexts (compatibility)
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "null",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Cookie",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

const SESSION_PREFIX = "admin_session_";
const SESSION_TTL = 86400;

function getSessionId(request: Request): string | null {
  const cookie = request.headers.get("Cookie") ?? "";
  const match = cookie.match(/admin_session=([^;]+)/);
  return match ? match[1] : null;
}

// MED-2 fix: validate session with IP + UA fingerprint check
async function validateSession(request: Request, kv: KVNamespace): Promise<boolean> {
  const sid = getSessionId(request);
  if (!sid) return false;
  const raw = await kv.get(`${SESSION_PREFIX}${sid}`);
  if (!raw) return false;
  // L-5 fix (2026-03-19): legacy "valid" sessions removed — require fingerprinted sessions
  try {
    const session = JSON.parse(raw) as { valid: boolean; ip?: string; ua?: string };
    if (!session.valid) return false;
    const currentIp = request.headers.get("CF-Connecting-IP") ?? "unknown";
    const currentUa = (request.headers.get("User-Agent") ?? "unknown").slice(0, 200);
    if (session.ip && session.ip !== currentIp) return false;
    if (session.ua && session.ua !== currentUa) return false;
    return true;
  } catch {
    return false;
  }
}

// MED-2 fix: bind session to IP + UA fingerprint
async function createSession(kv: KVNamespace, request: Request): Promise<string> {
  const sid = crypto.randomUUID();
  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const ua = (request.headers.get("User-Agent") ?? "unknown").slice(0, 200);
  await kv.put(`${SESSION_PREFIX}${sid}`, JSON.stringify({ valid: true, ip, ua }), { expirationTtl: SESSION_TTL });
  return sid;
}

async function destroySession(request: Request, kv: KVNamespace): Promise<void> {
  const sid = getSessionId(request);
  if (sid) await kv.delete(`${SESSION_PREFIX}${sid}`);
}

function sessionCookie(sid: string): string {
  return `admin_session=${sid}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_TTL}`;
}

function clearCookie(): string {
  return "admin_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0";
}

// HIGH-3 fix: timing-safe string comparison to prevent timing attacks on password/PIN
async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode("timing-safe-compare-key");
  const key = await crypto.subtle.importKey(
    "raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const [sigA, sigB] = await Promise.all([
    crypto.subtle.sign("HMAC", key, encoder.encode(a)),
    crypto.subtle.sign("HMAC", key, encoder.encode(b)),
  ]);
  const viewA = new Uint8Array(sigA);
  const viewB = new Uint8Array(sigB);
  if (viewA.length !== viewB.length) return false;
  let result = 0;
  for (let i = 0; i < viewA.length; i++) {
    result |= viewA[i] ^ viewB[i];
  }
  return result === 0;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// ---------------------------------------------------------------------------
// Login page
// ---------------------------------------------------------------------------

function loginPage(error?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Admin — GHL MCP</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#070d1a;color:#e2e8f0;min-height:100vh;display:flex;align-items:center;justify-content:center}
    .wrap{width:100%;max-width:380px;padding:1rem}
    .logo{text-align:center;margin-bottom:2rem}
    .logo-mark{width:48px;height:48px;background:linear-gradient(135deg,#3b82f6,#8b5cf6);border-radius:12px;display:inline-flex;align-items:center;justify-content:center;font-size:1.4rem;margin-bottom:.75rem}
    .logo h1{font-size:1.2rem;color:#f8fafc;font-weight:700}.logo p{font-size:.8rem;color:#64748b;margin-top:.2rem}
    .card{background:#0f1929;border:1px solid #1e2d45;border-radius:14px;padding:2rem}
    label{display:block;font-size:.78rem;color:#94a3b8;margin-bottom:.3rem;font-weight:600;letter-spacing:.04em;text-transform:uppercase}
    input[type="password"]{width:100%;padding:.65rem .9rem;border-radius:8px;border:1px solid #1e2d45;background:#070d1a;color:#f1f5f9;font-size:.9rem;margin-bottom:1.25rem;outline:none;transition:border-color .2s}
    input:focus{border-color:#3b82f6}
    button{width:100%;padding:.75rem;border:none;border-radius:8px;background:linear-gradient(135deg,#3b82f6,#6366f1);color:#fff;font-size:.9rem;font-weight:600;cursor:pointer}
    button:hover{opacity:.9}
    .error{background:#1f0a0a;border:1px solid #7f1d1d;color:#fca5a5;padding:.65rem .9rem;border-radius:8px;margin-bottom:1rem;font-size:.83rem}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="logo">
      <div class="logo-mark">&#9889;</div>
      <h1>GHL MCP Control</h1><p>Internal Admin Access</p>
    </div>
    <div class="card">
      ${error ? `<div class="error">${escapeHtml(error)}</div>` : ""}
      <form method="POST" action="/admin/login">
        <label for="password">Admin Password</label>
        <input type="password" id="password" name="password" required autofocus placeholder="Enter password" />
        <button type="submit">Sign In</button>
      </form>
    </div>
  </div>
</body></html>`;
}

// ---------------------------------------------------------------------------
// Dashboard page
// ---------------------------------------------------------------------------

const DASHBOARD_JS = String.raw`
// ─── Data ────────────────────────────────────────────────────────────────────
var allUsers = [], allAccounts = [];

var SCOPE_CATEGORIES = {
  "Contacts": [
    "ghl_get_contact","ghl_create_contact","ghl_update_contact","ghl_delete_contact",
    "ghl_search_contacts","ghl_list_contacts","ghl_upsert_contact",
    "ghl_get_contact_notes","ghl_create_contact_note","ghl_update_contact_note","ghl_delete_contact_note",
    "ghl_get_contact_tasks","ghl_create_contact_task","ghl_update_contact_task","ghl_delete_contact_task",
    "ghl_get_contact_appointments","ghl_add_contact_tags","ghl_remove_contact_tags","ghl_bulk_update_contact_tags",
    "ghl_add_contact_to_campaign","ghl_remove_contact_from_campaign","ghl_remove_contact_from_all_campaigns",
    "ghl_add_contact_to_workflow","ghl_remove_contact_from_workflow",
    "ghl_add_contact_followers","ghl_remove_contact_followers",
    "ghl_find_duplicate_contacts","ghl_merge_duplicate_contacts","ghl_verify_email"
  ],
  "Conversations": [
    "ghl_get_conversation","ghl_create_conversation","ghl_update_conversation","ghl_delete_conversation",
    "ghl_search_conversations","ghl_get_conversation_messages","ghl_get_message",
    "ghl_send_message","ghl_add_inbound_message","ghl_get_email_message","ghl_delete_email_message",
    "ghl_cancel_scheduled_messages","ghl_update_message_status",
    "ghl_add_message_attachments","ghl_upload_message_attachment","ghl_export_messages",
    "ghl_send_typing_indicator","ghl_add_outbound_call",
    "ghl_get_recording","ghl_get_transcription","ghl_download_transcription",
    "ghl_get_call_log","ghl_list_call_logs"
  ],
  "AI Agents": [
    "ghl_get_conversation_agent","ghl_create_conversation_agent","ghl_update_conversation_agent",
    "ghl_delete_conversation_agent","ghl_search_conversation_agents",
    "ghl_get_conversation_action","ghl_create_conversation_action","ghl_update_conversation_action",
    "ghl_delete_conversation_action","ghl_list_conversation_actions","ghl_get_conversation_generation",
    "ghl_execute_agent_studio_agent","ghl_get_agent_studio_agent","ghl_list_agent_studio_agents",
    "ghl_get_voice_agent","ghl_create_voice_agent","ghl_update_voice_agent","ghl_delete_voice_agent","ghl_list_voice_agents",
    "ghl_get_voice_action","ghl_create_voice_action","ghl_update_voice_action","ghl_delete_voice_action",
    "ghl_kb_create","ghl_kb_get","ghl_kb_update","ghl_kb_delete","ghl_kb_list",
    "ghl_kb_create_crawler","ghl_kb_get_crawler","ghl_kb_update_crawler","ghl_kb_delete_crawler","ghl_kb_list_crawlers",
    "ghl_kb_create_faq","ghl_kb_update_faq","ghl_kb_delete_faq","ghl_kb_list_faqs"
  ],
  "Opportunities": [
    "ghl_get_opportunity","ghl_create_opportunity","ghl_update_opportunity","ghl_delete_opportunity",
    "ghl_search_opportunities","ghl_upsert_opportunity","ghl_update_opportunity_status",
    "ghl_get_pipeline","ghl_create_pipeline","ghl_update_pipeline","ghl_delete_pipeline","ghl_list_pipelines",
    "ghl_add_opportunity_followers","ghl_remove_opportunity_followers"
  ],
  "Calendars": [
    "ghl_get_calendar","ghl_create_calendar","ghl_update_calendar","ghl_delete_calendar","ghl_list_calendars",
    "ghl_get_calendar_free_slots","ghl_get_appointment","ghl_create_appointment","ghl_update_appointment","ghl_delete_appointment",
    "ghl_list_calendar_events","ghl_get_calendar_group","ghl_create_calendar_group","ghl_update_calendar_group",
    "ghl_delete_calendar_group","ghl_update_calendar_group_status","ghl_validate_group_slug","ghl_list_calendar_groups",
    "ghl_get_calendar_notification","ghl_create_calendar_notification","ghl_update_calendar_notification",
    "ghl_delete_calendar_notification","ghl_list_calendar_notifications",
    "ghl_get_calendar_resource","ghl_create_calendar_resource","ghl_update_calendar_resource",
    "ghl_delete_calendar_resource","ghl_list_calendar_resources",
    "ghl_create_blocked_slot","ghl_update_blocked_slot","ghl_delete_blocked_slot","ghl_list_blocked_slots",
    "ghl_create_appointment_note","ghl_update_appointment_note","ghl_delete_appointment_note","ghl_get_appointment_notes"
  ],
  "Payments": [
    "ghl_get_invoice","ghl_create_invoice","ghl_update_invoice","ghl_delete_invoice","ghl_list_invoices",
    "ghl_send_invoice","ghl_void_invoice","ghl_record_invoice_payment","ghl_schedule_invoice",
    "ghl_cancel_scheduled_invoice","ghl_update_invoice_last_visited","ghl_update_invoice_late_fees_config",
    "ghl_generate_invoice_number","ghl_get_invoice_template","ghl_create_invoice_template","ghl_update_invoice_template",
    "ghl_delete_invoice_template","ghl_list_invoice_templates",
    "ghl_update_template_late_fees_config","ghl_update_template_payment_methods_config",
    "ghl_get_invoice_schedule","ghl_create_invoice_schedule","ghl_update_invoice_schedule",
    "ghl_delete_invoice_schedule","ghl_list_invoice_schedules","ghl_manage_schedule_auto_payment",
    "ghl_get_transaction","ghl_list_transactions","ghl_get_order","ghl_list_orders","ghl_record_order_payment",
    "ghl_get_order_fulfillments","ghl_create_order_fulfillment","ghl_list_order_notes",
    "ghl_get_subscription","ghl_list_subscriptions","ghl_cancel_subscription",
    "ghl_get_estimate","ghl_create_estimate","ghl_update_estimate","ghl_delete_estimate",
    "ghl_send_estimate","ghl_generate_estimate_number","ghl_list_estimates",
    "ghl_get_estimate_template","ghl_create_estimate_template","ghl_update_estimate_template",
    "ghl_delete_estimate_template","ghl_list_estimate_templates","ghl_convert_estimate_to_invoice","ghl_create_text2pay"
  ],
  "Products": [
    "ghl_get_product","ghl_create_product","ghl_update_product","ghl_delete_product","ghl_list_products",
    "ghl_get_product_price","ghl_create_product_price","ghl_update_product_price","ghl_delete_product_price",
    "ghl_list_product_prices","ghl_list_product_prices_by_location",
    "ghl_get_product_inventory","ghl_update_product_inventory","ghl_get_product_store_stats",
    "ghl_update_product_priority","ghl_add_product_to_store","ghl_bulk_edit_products","ghl_bulk_update_products",
    "ghl_get_product_collection","ghl_create_product_collection","ghl_delete_product_collection","ghl_list_product_collections",
    "ghl_get_coupon","ghl_create_coupon","ghl_update_coupon","ghl_delete_coupon","ghl_list_coupons",
    "ghl_update_product_review","ghl_delete_product_review","ghl_list_product_reviews","ghl_bulk_update_reviews","ghl_get_review_count",
    "ghl_get_store_settings","ghl_update_store_settings",
    "ghl_list_shipping_carriers","ghl_create_shipping_carrier","ghl_list_shipping_zones","ghl_create_shipping_zone","ghl_list_shipping_rates"
  ],
  "Marketing": [
    "ghl_create_social_post","ghl_edit_social_post","ghl_delete_social_post","ghl_get_social_post","ghl_list_social_posts","ghl_bulk_delete_social_posts",
    "ghl_get_social_accounts","ghl_get_social_account_details","ghl_attach_social_account","ghl_detach_social_account","ghl_delete_social_account",
    "ghl_get_social_categories","ghl_get_social_statistics","ghl_list_social_tags",
    "ghl_upload_social_csv","ghl_get_social_csv_status","ghl_delete_social_csv",
    "ghl_start_facebook_oauth","ghl_start_instagram_oauth","ghl_start_linkedin_oauth",
    "ghl_start_tiktok_oauth","ghl_start_tiktok_business_oauth","ghl_start_twitter_oauth","ghl_start_google_oauth",
    "ghl_get_campaigns","ghl_get_campaign","ghl_create_campaign","ghl_update_campaign","ghl_list_email_campaigns",
    "ghl_get_email","ghl_create_email","ghl_update_email","ghl_delete_email","ghl_list_emails",
    "ghl_get_email_template","ghl_create_email_template","ghl_update_email_template","ghl_delete_email_template","ghl_list_email_templates",
    "ghl_get_email_schedule","ghl_cancel_scheduled_email",
    "ghl_get_blog","ghl_create_blog","ghl_update_blog","ghl_delete_blog","ghl_list_blogs",
    "ghl_list_blog_authors","ghl_list_blog_categories",
    "ghl_get_blog_post","ghl_create_blog_post","ghl_update_blog_post","ghl_delete_blog_post","ghl_list_blog_posts"
  ],
  "Settings": [
    "ghl_get_location","ghl_update_location","ghl_delete_location","ghl_create_location",
    "ghl_search_locations","ghl_list_sub_accounts","ghl_get_location_timezones",
    "ghl_get_location_business","ghl_update_location_business",
    "ghl_get_location_custom_fields","ghl_create_location_custom_field","ghl_update_location_custom_field","ghl_delete_location_custom_field",
    "ghl_list_location_tags","ghl_list_location_templates",
    "ghl_list_custom_fields_v2","ghl_create_custom_field","ghl_update_custom_field","ghl_delete_custom_field",
    "ghl_create_custom_field_folder","ghl_update_custom_field_folder","ghl_delete_custom_field_folder",
    "ghl_list_custom_values","ghl_create_custom_value","ghl_update_custom_value","ghl_delete_custom_value","ghl_get_custom_field",
    "ghl_list_custom_menus","ghl_create_custom_menu","ghl_update_custom_menu","ghl_delete_custom_menu","ghl_get_custom_menu","ghl_check_url_slug",
    "ghl_list_tags","ghl_create_tag","ghl_update_tag","ghl_delete_tag",
    "ghl_get_business_profile","ghl_update_business_profile","ghl_update_followup_settings"
  ],
  "Users & Team": [
    "ghl_get_user","ghl_create_user","ghl_update_user","ghl_delete_user","ghl_list_users","ghl_search_users","ghl_filter_users_by_email",
    "ghl_get_business","ghl_create_business","ghl_update_business","ghl_delete_business","ghl_list_businesses","ghl_list_businesses_v2","ghl_get_contacts_by_business",
    "ghl_get_company","ghl_create_company","ghl_update_company","ghl_delete_company","ghl_list_companies",
    "ghl_get_phone_number","ghl_list_phone_numbers","ghl_update_phone_number","ghl_release_phone_number",
    "ghl_purchase_phone_number","ghl_list_active_numbers","ghl_list_number_pools","ghl_search_location_tasks"
  ],
  "Workflows": [
    "ghl_get_workflow","ghl_create_workflow","ghl_update_workflow","ghl_list_workflows",
    "ghl_list_forms","ghl_get_form","ghl_get_form_submissions","ghl_upload_form_custom_files",
    "ghl_list_surveys","ghl_get_survey","ghl_get_survey_submissions",
    "ghl_list_funnels","ghl_list_funnel_pages","ghl_get_funnel_page_count",
    "ghl_list_redirects","ghl_create_redirect","ghl_update_redirect","ghl_delete_redirect",
    "ghl_get_link","ghl_create_link","ghl_update_link","ghl_delete_link","ghl_list_links","ghl_search_links",
    "ghl_create_recurring_task","ghl_update_recurring_task","ghl_delete_recurring_task","ghl_get_recurring_task","ghl_update_task_completed"
  ],
  "Media": [
    "ghl_list_media","ghl_delete_media","ghl_bulk_delete_media","ghl_create_media_folder","ghl_update_media","ghl_update_media_files",
    "ghl_upload_file","ghl_upload_custom_field_file",
    "ghl_get_template","ghl_create_template","ghl_update_template","ghl_delete_template","ghl_list_templates",
    "ghl_list_document_templates","ghl_list_documents","ghl_send_document","ghl_send_document_template","ghl_import_course"
  ],
  "Objects & CRM": [
    "ghl_get_object_schema","ghl_create_object","ghl_update_object","ghl_list_custom_objects",
    "ghl_get_object_record","ghl_create_object_record","ghl_update_object_record","ghl_delete_object_record","ghl_search_object_records",
    "ghl_get_association","ghl_create_association","ghl_update_association","ghl_delete_association","ghl_list_associations",
    "ghl_get_association_by_key","ghl_get_association_by_object_key",
    "ghl_create_relation","ghl_delete_relation","ghl_get_relations",
    "ghl_get_brand_board","ghl_create_brand_board","ghl_update_brand_board","ghl_delete_brand_board","ghl_list_brand_boards"
  ],
  "Snapshots & SaaS": [
    "ghl_get_snapshot","ghl_get_snapshots","ghl_get_last_snapshot_push","ghl_get_snapshot_push_status","ghl_create_snapshot_share_link",
    "ghl_saas_enable","ghl_saas_pause","ghl_saas_bulk_enable","ghl_saas_bulk_disable",
    "ghl_saas_get_agency_plans","ghl_saas_get_plan","ghl_saas_get_location","ghl_saas_list_locations",
    "ghl_saas_get_subscription","ghl_saas_update_subscription","ghl_saas_update_rebilling",
    "ghl_marketplace_check_has_funds","ghl_marketplace_create_billing_charge","ghl_marketplace_update_billing_charge",
    "ghl_marketplace_delete_billing_charge","ghl_marketplace_get_billing_charge",
    "ghl_marketplace_get_app_installation","ghl_marketplace_list_app_installations",
    "ghl_add_sub_account","ghl_remove_sub_account","ghl_update_sub_account_token","ghl_list_errors","ghl_clear_errors"
  ],
  "Workflow Builder (Internal)": [
    "ghl_workflow_builder_list","ghl_workflow_builder_create","ghl_workflow_builder_get",
    "ghl_workflow_builder_get_steps","ghl_workflow_builder_get_triggers",
    "ghl_workflow_builder_update","ghl_workflow_builder_save_steps",
    "ghl_workflow_builder_publish","ghl_workflow_builder_draft","ghl_workflow_builder_delete",
    "ghl_workflow_builder_create_trigger","ghl_workflow_builder_update_trigger","ghl_workflow_builder_delete_trigger",
    "ghl_workflow_builder_create_folder","ghl_workflow_builder_clone","ghl_workflow_builder_error_count"
  ]
};

// Read-only tools (all ghl_get_* / ghl_list_* / ghl_search_*)
var READ_ONLY = Object.values(SCOPE_CATEGORIES).flat().filter(function(t){
  return /^ghl_(get|list|search|filter|find|download|export)_/.test(t);
});

var ALL_TOOLS = Object.values(SCOPE_CATEGORIES).flat();

// ─── Scope Picker ─────────────────────────────────────────────────────────────

function buildScopePicker(prefix, selectedScopes) {
  var all = selectedScopes.includes('*');
  var sel = new Set(all ? ALL_TOOLS : selectedScopes);
  var catKeys = Object.keys(SCOPE_CATEGORIES);
  var activeCat = 'all';

  var html = '<div class="scope-picker">';
  // Quick presets
  html += '<div class="scope-top"><span class="scope-top-label">Quick Presets</span><div class="qp-row">';
  html += '<button class="qp" id="' + prefix + '-qp-all" onclick="scopePreset(\'' + prefix + '\',\'all\')">Full Access</button>';
  html += '<button class="qp" id="' + prefix + '-qp-read" onclick="scopePreset(\'' + prefix + '\',\'read\')">Read Only</button>';
  html += '<button class="qp" id="' + prefix + '-qp-none" onclick="scopePreset(\'' + prefix + '\',\'none\')">No Access</button>';
  html += '</div></div>';
  // Category filter pills
  html += '<div class="cat-row" id="' + prefix + '-cat-row">';
  html += '<button class="cat-pill active" onclick="filterCat(\'' + prefix + '\',\'all\',this)">All</button>';
  catKeys.forEach(function(cat){ html += '<button class="cat-pill" onclick="filterCat(\'' + prefix + '\',\'' + cat.replace(/'/g, "\\'") + '\',this)">' + cat + '</button>'; });
  html += '</div>';
  // Tool panels
  html += '<div class="tool-panel" id="' + prefix + '-tool-panel">';
  catKeys.forEach(function(cat){
    var tools = SCOPE_CATEGORIES[cat];
    html += '<div class="cat-group" data-cat="' + cat.replace(/"/g, '&quot;') + '">';
    html += '<div class="cg-header"><span class="cg-name">' + cat + ' <span style="color:var(--mu);font-weight:400;font-size:.68rem">(' + tools.length + ')</span></span>';
    html += '<div class="cg-actions"><button class="mini-btn" onclick="catSelectAll(\'' + prefix + '\',\'' + cat.replace(/'/g, "\\'") + '\',true)">All</button>';
    html += '<button class="mini-btn" onclick="catSelectAll(\'' + prefix + '\',\'' + cat.replace(/'/g, "\\'") + '\',false)">None</button></div></div>';
    html += '<div class="tool-grid-inner">';
    tools.forEach(function(t){
      var short = t.replace('ghl_','');
      html += '<label class="tool-check"><input type="checkbox" value="' + t + '" data-cat="' + cat.replace(/"/g,'&quot;') + '" class="' + prefix + '-scb" ' + (sel.has(t) ? 'checked' : '') + ' onchange="updateScopeCount(\'' + prefix + '\')">';
      html += '<span title="' + t + '">' + short + '</span></label>';
    });
    html += '</div></div>';
  });
  html += '</div>';
  // Footer
  html += '<div class="scope-foot"><span class="scope-count" id="' + prefix + '-scount"></span></div>';
  html += '</div>';

  document.getElementById(prefix + '-scope-container').innerHTML = html;
  updateScopeCount(prefix);
  updatePresetHighlight(prefix);
}

function filterCat(prefix, cat, btn) {
  var panel = document.getElementById(prefix + '-tool-panel');
  var groups = panel.querySelectorAll('.cat-group');
  groups.forEach(function(g){
    g.style.display = (cat === 'all' || g.dataset.cat === cat) ? '' : 'none';
  });
  var pills = document.getElementById(prefix + '-cat-row').querySelectorAll('.cat-pill');
  pills.forEach(function(p){ p.classList.remove('active'); });
  if (btn) btn.classList.add('active');
}

function catSelectAll(prefix, cat, check) {
  var cbs = document.querySelectorAll('.' + prefix + '-scb[data-cat="' + cat + '"]');
  cbs.forEach(function(cb){ cb.checked = check; });
  updateScopeCount(prefix);
  updatePresetHighlight(prefix);
}

function scopePreset(prefix, preset) {
  var cbs = document.querySelectorAll('.' + prefix + '-scb');
  cbs.forEach(function(cb){
    if (preset === 'all') cb.checked = true;
    else if (preset === 'none') cb.checked = false;
    else cb.checked = READ_ONLY.indexOf(cb.value) !== -1;
  });
  updateScopeCount(prefix);
  updatePresetHighlight(prefix);
}

function updateScopeCount(prefix) {
  var cbs = document.querySelectorAll('.' + prefix + '-scb');
  var checked = 0;
  cbs.forEach(function(cb){ if (cb.checked) checked++; });
  var el = document.getElementById(prefix + '-scount');
  if (el) el.innerHTML = '<strong>' + checked + '</strong> of ' + ALL_TOOLS.length + ' tools selected';
}

function updatePresetHighlight(prefix) {
  var cbs = document.querySelectorAll('.' + prefix + '-scb');
  var checked = [], all = cbs.length;
  cbs.forEach(function(cb){ if (cb.checked) checked.push(cb.value); });
  var isAll = checked.length === all;
  var isNone = checked.length === 0;
  var readSet = new Set(READ_ONLY);
  var isRead = !isAll && !isNone && checked.length === READ_ONLY.length && checked.every(function(t){ return readSet.has(t); });
  ['all','read','none'].forEach(function(p){
    var btn = document.getElementById(prefix + '-qp-' + p);
    if (!btn) return;
    btn.className = 'qp';
    if (p === 'all' && isAll) btn.classList.add('qp-all');
    else if (p === 'read' && isRead) btn.classList.add('qp-read');
    else if (p === 'none' && isNone) btn.classList.add('qp-none');
  });
}

function getScopesFromPicker(prefix) {
  var cbs = document.querySelectorAll('.' + prefix + '-scb');
  var checked = [];
  cbs.forEach(function(cb){ if (cb.checked) checked.push(cb.value); });
  if (checked.length === ALL_TOOLS.length) return '["*"]';
  return JSON.stringify(checked);
}

// ─── API ─────────────────────────────────────────────────────────────────────

async function api(method, path, body) {
  var opts = { method: method, headers: {'Content-Type':'application/json'}, credentials: 'same-origin' };
  if (body !== undefined) opts.body = JSON.stringify(body);
  var res = await fetch(path, opts);
  var text = await res.text();
  if (!res.ok) throw new Error(text || res.statusText);
  try { return JSON.parse(text); } catch(e) { return text; }
}

function toast(msg, isErr) {
  var el = document.getElementById('toast');
  el.textContent = msg;
  el.className = isErr ? 'err' : '';
  el.style.display = 'block';
  setTimeout(function(){ el.style.display='none'; }, 2800);
}

// ─── Navigation ──────────────────────────────────────────────────────────────

function showSection(name) {
  document.querySelectorAll('.ps').forEach(function(s){ s.classList.remove('active'); });
  document.querySelectorAll('.nav-link').forEach(function(n){ n.classList.remove('active'); });
  document.getElementById('section-'+name).classList.add('active');
  document.getElementById('nav-'+name).classList.add('active');
}

// ─── Load & Render ───────────────────────────────────────────────────────────

async function loadAll() { await Promise.all([loadUsers(), loadAccounts()]); }

async function loadUsers() {
  try {
    var data = await api('GET', '/api/admin/users');
    allUsers = data.users || [];
    renderStats(); renderUsers();
  } catch(e) {
    document.getElementById('users-wrap').innerHTML = '<p class="loading err-text">Failed: '+e.message+'</p>';
  }
}

async function loadAccounts() {
  try {
    var data = await api('GET', '/api/admin/accounts');
    allAccounts = data.accounts || [];
    renderStats(); renderAccounts();
  } catch(e) {
    document.getElementById('accounts-wrap').innerHTML = '<p class="loading err-text">Failed: '+e.message+'</p>';
  }
}

function renderStats() {
  document.getElementById('s-total').textContent = allUsers.length;
  document.getElementById('s-active').textContent = allUsers.filter(function(u){return u.status==='active';}).length;
  document.getElementById('s-pending').textContent = allUsers.filter(function(u){return u.status==='pending';}).length;
  document.getElementById('s-accounts').textContent = allAccounts.length;
}

function renderUsers() {
  var wrap = document.getElementById('users-wrap');
  if (!allUsers.length) { wrap.innerHTML='<p class="empty">No users yet. Click <strong>Add User</strong> to create one.</p>'; return; }
  var html = '<table><thead><tr><th>Name</th><th>Email</th><th>Status</th><th>Tool Access</th><th>Account Access</th><th>Created</th><th>Actions</th></tr></thead><tbody>';
  allUsers.forEach(function(u){
    html += '<tr>';
    html += '<td><strong style="color:#f8fafc">'+esc(u.name)+'</strong></td>';
    html += '<td style="color:#94a3b8">'+esc(u.email)+'</td>';
    html += '<td>'+badge(u.status)+'</td>';
    html += '<td>'+scopeSummary(u.scopes)+'</td>';
    html += '<td>'+acctSummary(u.allowed_accounts)+'</td>';
    html += '<td style="color:#64748b;font-size:.76rem">'+(u.created_at?u.created_at.split('T')[0]:'')+'</td>';
    html += '<td><div class="acts">';
    if (u.status !== 'active') html += '<button class="btn btn-sm btn-ok" onclick="setStatus(\''+u.id+'\',\'active\')">Enable</button>';
    if (u.status === 'active')  html += '<button class="btn btn-sm btn-warn" onclick="setStatus(\''+u.id+'\',\'disabled\')">Disable</button>';
    html += '<button class="btn btn-sm btn-ghost" data-id="'+esc(u.id)+'" data-status="'+esc(u.status)+'" data-scopes="'+esc(u.scopes)+'" data-accounts="'+esc(u.allowed_accounts||'["*"]')+'" data-notes="'+esc(u.notes||'')+'" onclick="openEditModal(this)">Edit</button>';
    html += '<button class="btn btn-sm btn-del" onclick="removeUser(\''+u.id+'\')">Delete</button>';
    html += '</div></td></tr>';
  });
  html += '</tbody></table>';
  wrap.innerHTML = html;
}

function scopeSummary(scopes) {
  try {
    var arr = JSON.parse(scopes);
    if (arr.includes('*')) return '<span class="sp sp-all">Full Access</span>';
    if (!arr.length) return '<span class="sp">None</span>';
    return '<span class="sp">'+arr.length+' tools</span>';
  } catch(e) { return '<span class="sp err-text">invalid</span>'; }
}

function acctSummary(accounts) {
  try {
    var arr = JSON.parse(accounts||'["*"]');
    if (arr.includes('*')) return '<span class="at">All Accounts</span>';
    if (!arr.length) return '<span class="at" style="color:#fca5a5">None</span>';
    return arr.map(function(id){ var a=allAccounts.find(function(x){return x.id===id;}); return '<span class="at">'+esc(a?a.name:id.slice(0,8)+'...')+'</span>'; }).join('');
  } catch(e) { return '<span class="at err-text">invalid</span>'; }
}

function badge(s) { var c=s==='active'?'ba':s==='pending'?'bp':'bd'; return '<span class="badge '+c+'"><span class="dot"></span>'+s+'</span>'; }

function renderAccounts() {
  var wrap = document.getElementById('accounts-wrap');
  if (!allAccounts.length) { wrap.innerHTML='<p class="empty">No accounts found.</p>'; return; }
  var html='<table><thead><tr><th>Name</th><th>Location ID</th><th>Type</th><th>Default</th><th>Created</th></tr></thead><tbody>';
  allAccounts.forEach(function(a){
    html+='<tr><td><strong style="color:#f8fafc">'+esc(a.name)+'</strong></td>';
    html+='<td style="font-family:monospace;font-size:.76rem;color:#94a3b8">'+esc(a.id)+'</td>';
    html+='<td style="color:#64748b">'+esc(a.account_type||'sub_account')+'</td>';
    html+='<td>'+(a.is_default?'<span class="badge ba"><span class="dot"></span>Default</span>':'')+'</td>';
    html+='<td style="color:#64748b;font-size:.76rem">'+(a.created_at||'')+'</td></tr>';
  });
  html+='</tbody></table>';
  wrap.innerHTML=html;
}

// ─── User actions ────────────────────────────────────────────────────────────

async function setStatus(id, status) {
  if (!confirm('Set user to '+status+'?')) return;
  try { await api('PATCH','/api/admin/users/'+id,{status:status}); toast('Status updated',false); await loadUsers(); }
  catch(e){ toast(e.message,true); }
}

async function removeUser(id) {
  if (!confirm('Delete this user?')) return;
  try { await api('DELETE','/api/admin/users/'+id); toast('Deleted',false); await loadUsers(); }
  catch(e){ toast(e.message,true); }
}

// ─── Account checkboxes ──────────────────────────────────────────────────────

function toggleAllAccounts(prefix) {
  var checked = document.getElementById(prefix+'-acct-all').checked;
  var list = document.getElementById(prefix+'-acct-list');
  list.style.display = checked ? 'none' : 'flex';
  list.style.flexDirection = 'column';
  if (!checked) buildAcctCheckboxes(prefix, null);
}

function buildAcctCheckboxes(prefix, selectedIds) {
  var list = document.getElementById(prefix+'-acct-list');
  list.innerHTML = '';
  allAccounts.forEach(function(a){
    var chk = !selectedIds || selectedIds.indexOf(a.id) !== -1;
    list.innerHTML += '<div class="acct-item"><input type="checkbox" id="'+prefix+'-acct-'+a.id+'" value="'+a.id+'" '+(chk?'checked':'')+'><label for="'+prefix+'-acct-'+a.id+'">'+esc(a.name)+' <span class="aid">'+a.id+'</span></label></div>';
  });
}

function getSelectedAccounts(prefix) {
  var allChk = document.getElementById(prefix+'-acct-all').checked;
  if (allChk) return '["*"]';
  var ids = [];
  allAccounts.forEach(function(a){ var cb=document.getElementById(prefix+'-acct-'+a.id); if(cb&&cb.checked) ids.push(a.id); });
  return JSON.stringify(ids);
}

// ─── Add User ────────────────────────────────────────────────────────────────

function openAddModal() {
  document.getElementById('add-name').value='';
  document.getElementById('add-email').value='';
  document.getElementById('add-status').value='active';
  document.getElementById('add-notes').value='';
  document.getElementById('add-acct-all').checked=true;
  document.getElementById('add-acct-list').style.display='none';
  buildScopePicker('add', ['*']);
  document.getElementById('add-modal').classList.add('open');
}

async function submitAddUser() {
  var name=document.getElementById('add-name').value.trim();
  var email=document.getElementById('add-email').value.trim();
  var status=document.getElementById('add-status').value;
  var notes=document.getElementById('add-notes').value.trim();
  var scopes=getScopesFromPicker('add');
  var allowed_accounts=getSelectedAccounts('add');
  if(!name||!email){ toast('Name and email required',true); return; }
  try {
    var res=await api('POST','/api/admin/users',{name:name,email:email,status:status,scopes:scopes,allowed_accounts:allowed_accounts,notes:notes});
    closeModal('add-modal'); await loadUsers();
    document.getElementById('apikey-display').textContent=res.api_key;
    document.getElementById('copy-hint').textContent='Click to copy to clipboard';
    document.getElementById('apikey-modal').classList.add('open');
    toast('User created',false);
  } catch(e){ toast(e.message,true); }
}

// ─── Edit User ───────────────────────────────────────────────────────────────

function openEditModal(btn) {
  var id=btn.dataset.id, status=btn.dataset.status;
  var scopes=btn.dataset.scopes, accounts=btn.dataset.accounts||'["*"]';
  var notes=btn.dataset.notes||'';
  document.getElementById('edit-user-id').value=id;
  document.getElementById('edit-status').value=status;
  document.getElementById('edit-notes').value=notes;

  var scopeArr;
  try { scopeArr=JSON.parse(scopes); } catch(e){ scopeArr=['*']; }
  buildScopePicker('edit', scopeArr);

  try {
    var acctArr=JSON.parse(accounts);
    var allAccts=acctArr.includes('*');
    document.getElementById('edit-acct-all').checked=allAccts;
    var list=document.getElementById('edit-acct-list');
    list.style.display=allAccts?'none':'flex'; list.style.flexDirection='column';
    if (!allAccts) buildAcctCheckboxes('edit', acctArr);
  } catch(e){ document.getElementById('edit-acct-all').checked=true; document.getElementById('edit-acct-list').style.display='none'; }

  document.getElementById('edit-modal').classList.add('open');
}

async function submitEditUser() {
  var id=document.getElementById('edit-user-id').value;
  var status=document.getElementById('edit-status').value;
  var scopes=getScopesFromPicker('edit');
  var allowed_accounts=getSelectedAccounts('edit');
  var notes=document.getElementById('edit-notes').value.trim();
  try {
    await api('PATCH','/api/admin/users/'+id,{status:status,scopes:scopes,allowed_accounts:allowed_accounts,notes:notes});
    closeModal('edit-modal'); await loadUsers(); toast('User updated',false);
  } catch(e){ toast(e.message,true); }
}

// ─── Modals ──────────────────────────────────────────────────────────────────

function closeModal(id){ document.getElementById(id).classList.remove('open'); }
document.querySelectorAll('.overlay').forEach(function(o){
  o.addEventListener('click', function(e){ if(e.target===o) o.classList.remove('open'); });
});

async function copyKey() {
  var key=document.getElementById('apikey-display').textContent;
  try { await navigator.clipboard.writeText(key); document.getElementById('copy-hint').textContent='Copied!'; }
  catch(e){ document.getElementById('copy-hint').textContent='Select and copy manually'; }
}

function esc(s){ var d=document.createElement('div'); d.textContent=String(s); return d.innerHTML; }

loadAll();
`;

function dashboardPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Admin — GHL MCP</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    :root{--bg:#070d1a;--sf:#0f1929;--b:#1e2d45;--tx:#e2e8f0;--mu:#64748b;--ac:#3b82f6;--pu:#8b5cf6}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:var(--bg);color:var(--tx);min-height:100vh}
    .layout{display:flex;min-height:100vh}
    .sidebar{width:210px;background:var(--sf);border-right:1px solid var(--b);padding:1.25rem .85rem;flex-shrink:0;display:flex;flex-direction:column}
    .main{flex:1;padding:1.75rem;overflow:auto}
    .sidebar-logo{display:flex;align-items:center;gap:.55rem;margin-bottom:2rem;padding:.3rem .4rem}
    .sidebar-logo .mark{width:30px;height:30px;background:linear-gradient(135deg,var(--ac),var(--pu));border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:.85rem;flex-shrink:0}
    .sidebar-logo span{font-weight:700;font-size:.9rem;color:#f8fafc}
    .nav-sec{font-size:.68rem;color:var(--mu);letter-spacing:.08em;text-transform:uppercase;margin:.85rem 0 .35rem;padding:0 .4rem}
    .nav-link{display:flex;align-items:center;gap:.55rem;padding:.45rem .7rem;border-radius:7px;font-size:.83rem;color:#94a3b8;cursor:pointer;text-decoration:none;transition:all .15s;border:none;background:none;width:100%;text-align:left}
    .nav-link:hover,.nav-link.active{background:#1e2d45;color:#f8fafc}
    .nav-link .ic{font-size:.95rem;width:1.1rem;text-align:center}
    .sidebar-foot{margin-top:auto;padding-top:.85rem;border-top:1px solid var(--b)}
    .logout-btn{display:flex;align-items:center;gap:.55rem;padding:.45rem .7rem;border-radius:7px;font-size:.83rem;color:#94a3b8;cursor:pointer;border:none;background:none;width:100%;text-align:left}
    .logout-btn:hover{background:#1f0a0a;color:#fca5a5}
    .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.85rem;margin-bottom:1.75rem}
    .sc{background:var(--sf);border:1px solid var(--b);border-radius:11px;padding:1.1rem;position:relative;overflow:hidden}
    .sc::before{content:'';position:absolute;top:0;left:0;right:0;height:2px}
    .sc.bl::before{background:var(--ac)}.sc.gr::before{background:#22c55e}.sc.ye::before{background:#f59e0b}.sc.pu::before{background:var(--pu)}
    .sl{font-size:.72rem;color:var(--mu);text-transform:uppercase;letter-spacing:.06em;margin-bottom:.35rem}
    .sv{font-size:1.7rem;font-weight:700;color:#f8fafc}.ss{font-size:.72rem;color:var(--mu);margin-top:.15rem}
    .ph{display:flex;align-items:center;justify-content:space-between;margin-bottom:1.25rem}
    .pt{font-size:1.1rem;font-weight:700;color:#f8fafc}
    .ps{display:none}.ps.active{display:block}
    .btn{display:inline-flex;align-items:center;gap:.3rem;padding:.38rem .8rem;border:none;border-radius:7px;font-size:.78rem;font-weight:600;cursor:pointer;transition:all .15s;white-space:nowrap}
    .btn-primary{background:linear-gradient(135deg,var(--ac),var(--pu));color:#fff}.btn-primary:hover{opacity:.9}
    .btn-ok{background:#14532d;color:#86efac;border:1px solid #16a34a}.btn-ok:hover{background:#166534}
    .btn-warn{background:#431407;color:#fed7aa;border:1px solid #d97706}.btn-warn:hover{background:#7c2d12}
    .btn-del{background:#1f0a0a;color:#fca5a5;border:1px solid #dc2626}.btn-del:hover{background:#7f1d1d}
    .btn-ghost{background:transparent;color:#94a3b8;border:1px solid var(--b)}.btn-ghost:hover{background:var(--b);color:#f8fafc}
    .btn-sm{padding:.22rem .55rem;font-size:.72rem}
    .tw{background:var(--sf);border:1px solid var(--b);border-radius:11px;overflow:hidden}
    table{width:100%;border-collapse:collapse;font-size:.81rem}
    th{text-align:left;padding:.65rem .9rem;background:#0a1322;color:#64748b;font-size:.7rem;text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid var(--b)}
    td{padding:.65rem .9rem;border-bottom:1px solid #0f1929;vertical-align:middle}
    tr:last-child td{border-bottom:none}tr:hover td{background:#0a1929}
    .acts{display:flex;gap:.3rem;align-items:center;flex-wrap:wrap}
    .badge{display:inline-flex;align-items:center;gap:.25rem;padding:.18rem .55rem;border-radius:9999px;font-size:.7rem;font-weight:600}
    .ba{background:#052e16;color:#86efac;border:1px solid #16a34a}
    .bp{background:#1c1003;color:#fde68a;border:1px solid #d97706}
    .bd{background:#1f0a0a;color:#fca5a5;border:1px solid #dc2626}
    .dot{width:5px;height:5px;border-radius:50%;display:inline-block}
    .ba .dot{background:#86efac}.bp .dot{background:#fde68a}.bd .dot{background:#fca5a5}
    .sp{display:inline-block;padding:.14rem .42rem;border-radius:5px;font-size:.68rem;font-family:monospace;background:#0a1322;color:#94a3b8;border:1px solid var(--b)}
    .sp-all{background:#052e16;color:#86efac;border-color:#16a34a}
    .at{display:inline-block;padding:.14rem .45rem;border-radius:5px;font-size:.68rem;background:#0d1e3a;color:#93c5fd;border:1px solid #1d4ed8;margin:.08rem}
    .overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:200;align-items:flex-start;justify-content:center;padding:1.5rem;overflow-y:auto}
    .overlay.open{display:flex}
    .modal{background:var(--sf);border:1px solid var(--b);border-radius:15px;padding:1.6rem;width:100%;max-width:640px;margin:auto}
    .mh{display:flex;align-items:center;justify-content:space-between;margin-bottom:1.35rem}
    .mt{font-size:.95rem;font-weight:700;color:#f8fafc}
    .xb{background:none;border:none;color:var(--mu);font-size:1.1rem;cursor:pointer;padding:.2rem;border-radius:4px}
    .xb:hover{color:#f8fafc;background:var(--b)}
    .mf{display:flex;gap:.55rem;justify-content:flex-end;margin-top:1.35rem;padding-top:1.1rem;border-top:1px solid var(--b)}
    .fg{margin-bottom:.9rem}
    .fl{display:block;font-size:.75rem;color:#94a3b8;margin-bottom:.3rem;font-weight:600;letter-spacing:.04em;text-transform:uppercase}
    .fi,.fs,.fta{width:100%;padding:.58rem .8rem;border-radius:7px;border:1px solid var(--b);background:#070d1a;color:#f1f5f9;font-size:.85rem;outline:none;transition:border-color .2s}
    .fi:focus,.fs:focus,.fta:focus{border-color:var(--ac)}
    .fta{min-height:70px;resize:vertical;font-family:monospace}
    .fr{display:grid;grid-template-columns:1fr 1fr;gap:.9rem}

    /* ── Scope Picker ── */
    .scope-picker{border:1px solid var(--b);border-radius:10px;overflow:hidden}
    .scope-top{display:flex;align-items:center;justify-content:space-between;padding:.6rem .85rem;background:#0a1322;border-bottom:1px solid var(--b);flex-wrap:wrap;gap:.4rem}
    .scope-top-label{font-size:.72rem;color:var(--mu);font-weight:600;text-transform:uppercase;letter-spacing:.05em}
    .qp-row{display:flex;gap:.35rem;flex-wrap:wrap}
    .qp{padding:.28rem .7rem;border-radius:6px;font-size:.75rem;font-weight:600;cursor:pointer;border:1px solid var(--b);background:var(--bg);color:#94a3b8;transition:all .15s}
    .qp:hover{border-color:var(--ac);background:#0d1e3a;color:#93c5fd}
    .qp.qp-all{border-color:#16a34a;background:#052e16;color:#86efac}
    .qp.qp-read{border-color:#d97706;background:#1c1003;color:#fde68a}
    .qp.qp-none{border-color:#dc2626;background:#1f0a0a;color:#fca5a5}
    /* Category pills */
    .cat-row{display:flex;gap:.3rem;padding:.55rem .75rem;border-bottom:1px solid var(--b);background:#0a1322;flex-wrap:wrap}
    .cat-pill{padding:.25rem .65rem;border-radius:6px;font-size:.73rem;font-weight:600;cursor:pointer;border:1px solid transparent;background:transparent;color:#64748b;transition:all .15s;white-space:nowrap}
    .cat-pill:hover{color:#94a3b8;background:#1e2d45}
    .cat-pill.active{border-color:var(--ac);background:#0d1e3a;color:#93c5fd}
    /* Tool list */
    .tool-panel{max-height:260px;overflow-y:auto;padding:.65rem .75rem}
    .cat-group{margin-bottom:.9rem}
    .cat-group:last-child{margin-bottom:0}
    .cg-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:.45rem;padding-bottom:.35rem;border-bottom:1px solid var(--b)}
    .cg-name{font-size:.76rem;font-weight:700;color:#cbd5e1}
    .cg-actions{display:flex;gap:.25rem}
    .mini-btn{padding:.15rem .45rem;border-radius:4px;font-size:.68rem;font-weight:600;cursor:pointer;border:1px solid var(--b);background:transparent;color:#64748b;transition:all .15s}
    .mini-btn:hover{background:var(--b);color:#f8fafc}
    .tool-grid-inner{display:grid;grid-template-columns:1fr 1fr;gap:.2rem}
    .tool-check{display:flex;align-items:center;gap:.4rem;padding:.22rem .3rem;border-radius:5px;cursor:pointer;transition:background .12s}
    .tool-check:hover{background:#0a1322}
    .tool-check input{accent-color:var(--ac);width:12px;height:12px;cursor:pointer;flex-shrink:0}
    .tool-check span{font-size:.72rem;color:#94a3b8;font-family:monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .tool-check input:checked + span{color:#cbd5e1}
    /* Footer */
    .scope-foot{display:flex;align-items:center;justify-content:space-between;padding:.5rem .85rem;background:#0a1322;border-top:1px solid var(--b)}
    .scope-count{font-size:.75rem;color:#94a3b8}
    .scope-count strong{color:#f8fafc}

    /* Account checkboxes */
    .acct-list{display:flex;flex-direction:column;gap:.35rem;max-height:160px;overflow-y:auto;padding:.45rem;border:1px solid var(--b);border-radius:7px;background:#070d1a}
    .acct-item{display:flex;align-items:center;gap:.55rem;padding:.3rem .45rem;border-radius:5px;cursor:pointer;transition:background .12s}
    .acct-item:hover{background:#0f1929}
    .acct-item input{accent-color:var(--ac);width:13px;height:13px;cursor:pointer}
    .acct-item label{cursor:pointer;font-size:.81rem;color:#cbd5e1;flex:1}
    .acct-item .aid{font-size:.68rem;color:var(--mu);font-family:monospace}
    .api-key-box{background:#070d1a;border:1px solid #16a34a;border-radius:8px;padding:.9rem;margin:.9rem 0}
    .api-key-box p{font-size:.75rem;color:#86efac;margin-bottom:.4rem}
    .api-key-val{font-family:monospace;font-size:.83rem;color:#f8fafc;word-break:break-all;cursor:pointer;user-select:all}
    .api-key-val:hover{color:#93c5fd}
    .copy-hint{font-size:.7rem;color:var(--mu);margin-top:.35rem}
    .loading{color:var(--mu);font-style:italic;padding:.9rem}
    .empty{color:var(--mu);text-align:center;padding:2rem}
    .err-text{color:#fca5a5;font-size:.81rem}
    #toast{position:fixed;bottom:1.5rem;right:1.5rem;background:#052e16;border:1px solid #16a34a;color:#86efac;padding:.6rem 1rem;border-radius:9px;font-size:.81rem;font-weight:600;display:none;z-index:9999}
    #toast.err{background:#1f0a0a;border-color:#dc2626;color:#fca5a5}
  </style>
</head>
<body>
<div class="layout">
  <div class="sidebar">
    <div class="sidebar-logo">
      <div class="mark">&#9889;</div><span>GHL MCP</span>
    </div>
    <div class="nav-sec">Management</div>
    <button class="nav-link active" onclick="showSection('users')" id="nav-users"><span class="ic">&#128101;</span> Users</button>
    <button class="nav-link" onclick="showSection('accounts')" id="nav-accounts"><span class="ic">&#127970;</span> Accounts</button>
    <div class="sidebar-foot">
      <form method="POST" action="/admin/logout">
        <button type="submit" class="logout-btn"><span class="ic">&#8594;</span> Sign Out</button>
      </form>
    </div>
  </div>
  <div class="main">
    <div class="stats">
      <div class="sc bl"><div class="sl">Total Users</div><div class="sv" id="s-total">&#8212;</div><div class="ss">registered</div></div>
      <div class="sc gr"><div class="sl">Active</div><div class="sv" id="s-active">&#8212;</div><div class="ss">with access</div></div>
      <div class="sc ye"><div class="sl">Pending</div><div class="sv" id="s-pending">&#8212;</div><div class="ss">awaiting approval</div></div>
      <div class="sc pu"><div class="sl">Accounts</div><div class="sv" id="s-accounts">&#8212;</div><div class="ss">sub-accounts</div></div>
    </div>
    <div class="ps active" id="section-users">
      <div class="ph"><div class="pt">Users</div><button class="btn btn-primary" onclick="openAddModal()">+ Add User</button></div>
      <div class="tw" id="users-wrap"><p class="loading">Loading...</p></div>
    </div>
    <div class="ps" id="section-accounts">
      <div class="ph"><div class="pt">Sub-Accounts</div></div>
      <div class="tw" id="accounts-wrap"><p class="loading">Loading...</p></div>
    </div>
  </div>
</div>

<!-- Add User Modal -->
<div class="overlay" id="add-modal">
  <div class="modal">
    <div class="mh"><span class="mt">Add New User</span><button class="xb" onclick="closeModal('add-modal')">&#10005;</button></div>
    <div class="fr">
      <div class="fg"><label class="fl">Name</label><input type="text" class="fi" id="add-name" placeholder="Full name" /></div>
      <div class="fg"><label class="fl">Email</label><input type="text" class="fi" id="add-email" placeholder="user@example.com" /></div>
    </div>
    <div class="fg">
      <label class="fl">Status</label>
      <select class="fs" id="add-status">
        <option value="active">Active — can use MCP immediately</option>
        <option value="pending">Pending — awaiting approval</option>
        <option value="disabled">Disabled — access blocked</option>
      </select>
    </div>
    <div class="fg">
      <label class="fl">Tool Access (Scopes)</label>
      <div id="add-scope-container"></div>
    </div>
    <div class="fg">
      <label class="fl">Account Access</label>
      <div style="margin-bottom:.45rem;display:flex;align-items:center;gap:.45rem">
        <input type="checkbox" id="add-acct-all" checked onchange="toggleAllAccounts('add')" style="accent-color:var(--ac);width:13px;height:13px;cursor:pointer">
        <label for="add-acct-all" style="font-size:.81rem;color:#cbd5e1;cursor:pointer">All Accounts</label>
      </div>
      <div class="acct-list" id="add-acct-list" style="display:none"></div>
    </div>
    <div class="fg"><label class="fl">Notes (optional)</label><input type="text" class="fi" id="add-notes" placeholder="Internal note" /></div>
    <div class="mf">
      <button class="btn btn-ghost" onclick="closeModal('add-modal')">Cancel</button>
      <button class="btn btn-primary" onclick="submitAddUser()">Create User</button>
    </div>
  </div>
</div>

<!-- Edit User Modal -->
<div class="overlay" id="edit-modal">
  <div class="modal">
    <div class="mh"><span class="mt">Edit User</span><button class="xb" onclick="closeModal('edit-modal')">&#10005;</button></div>
    <input type="hidden" id="edit-user-id" />
    <div class="fg">
      <label class="fl">Status</label>
      <select class="fs" id="edit-status">
        <option value="active">Active</option>
        <option value="pending">Pending</option>
        <option value="disabled">Disabled</option>
      </select>
    </div>
    <div class="fg">
      <label class="fl">Tool Access (Scopes)</label>
      <div id="edit-scope-container"></div>
    </div>
    <div class="fg">
      <label class="fl">Account Access</label>
      <div style="margin-bottom:.45rem;display:flex;align-items:center;gap:.45rem">
        <input type="checkbox" id="edit-acct-all" onchange="toggleAllAccounts('edit')" style="accent-color:var(--ac);width:13px;height:13px;cursor:pointer">
        <label for="edit-acct-all" style="font-size:.81rem;color:#cbd5e1;cursor:pointer">All Accounts</label>
      </div>
      <div class="acct-list" id="edit-acct-list"></div>
    </div>
    <div class="fg"><label class="fl">Notes</label><input type="text" class="fi" id="edit-notes" /></div>
    <div class="mf">
      <button class="btn btn-ghost" onclick="closeModal('edit-modal')">Cancel</button>
      <button class="btn btn-primary" onclick="submitEditUser()">Save Changes</button>
    </div>
  </div>
</div>

<!-- API Key Modal -->
<div class="overlay" id="apikey-modal">
  <div class="modal" style="max-width:460px">
    <div class="mh"><span class="mt">User Created</span><button class="xb" onclick="closeModal('apikey-modal')">&#10005;</button></div>
    <div style="font-size:.81rem;color:#94a3b8;margin-bottom:.4rem">Share this API key with the user. It will <strong style="color:#fca5a5">not be shown again</strong>.</div>
    <div class="api-key-box">
      <p>API Key (click to copy)</p>
      <div class="api-key-val" id="apikey-display" onclick="copyKey()"></div>
      <div class="copy-hint" id="copy-hint">Click to copy to clipboard</div>
    </div>
    <div style="font-size:.78rem;color:#64748b">Connect with:<br><code style="color:#93c5fd;font-size:.75rem">https://dlf-agency.skool-203.workers.dev/mcp?user_key=&lt;key&gt;</code></div>
    <div class="mf"><button class="btn btn-ghost" onclick="copyKey()">Copy Key</button><button class="btn btn-primary" onclick="closeModal('apikey-modal')">Done</button></div>
  </div>
</div>

<div id="toast"></div>

<script>
${DASHBOARD_JS}

</script>
</body></html>`;
}

// ---------------------------------------------------------------------------
// Route handler (unchanged)
// ---------------------------------------------------------------------------

export async function handleAdmin(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  // CRIT-3 fix: use same-origin CORS for admin routes, not wildcard
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: getAdminCorsHeaders(request) });

  if (path === "/admin" && request.method === "GET") {
    const valid = await validateSession(request, env.OAUTH_KV);
    if (valid) return Response.redirect(new URL("/admin/dashboard", url.origin).toString(), 302);
    return new Response(loginPage(), { headers: { "Content-Type": "text/html;charset=UTF-8", ...CORS_HEADERS } });
  }

  if (path === "/admin/login" && request.method === "POST") {
    // HIGH-2 fix: rate limit login — 5 attempts per minute per IP
    const ip = getClientIp(request);
    const rl = await checkRateLimit(env.OAUTH_KV, `rl:admin-login:${ip}`, 5, 60);
    if (!rl.allowed) return rateLimitResponse(rl);
    if (!env.ADMIN_PASSWORD) return new Response(loginPage("Admin password not configured."), { status: 500, headers: { "Content-Type": "text/html;charset=UTF-8", ...CORS_HEADERS } });
    let password: string;
    const ct = request.headers.get("Content-Type") ?? "";
    if (ct.includes("application/json")) {
      password = ((await request.json()) as { password?: string }).password ?? "";
    } else {
      password = ((await request.formData()).get("password") as string) ?? "";
    }
    if (!(await timingSafeEqual(password, env.ADMIN_PASSWORD))) return new Response(loginPage("Invalid password."), { status: 401, headers: { "Content-Type": "text/html;charset=UTF-8", ...CORS_HEADERS } });
    const sid = await createSession(env.OAUTH_KV, request);
    return new Response(null, { status: 302, headers: { Location: "/admin/dashboard", "Set-Cookie": sessionCookie(sid), ...CORS_HEADERS } });
  }

  if (path === "/admin/logout" && request.method === "POST") {
    await destroySession(request, env.OAUTH_KV);
    return new Response(null, { status: 302, headers: { Location: "/admin", "Set-Cookie": clearCookie(), ...CORS_HEADERS } });
  }

  const valid = await validateSession(request, env.OAUTH_KV);
  if (!valid) {
    if (path.startsWith("/api/admin")) return Response.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
    return Response.redirect(new URL("/admin", url.origin).toString(), 302);
  }

  if (path === "/admin/dashboard" && request.method === "GET") {
    return new Response(dashboardPage(), { headers: { "Content-Type": "text/html;charset=UTF-8", ...CORS_HEADERS } });
  }

  if (path === "/api/admin/users" && request.method === "GET") {
    await initUsersDb(env.GHL_DB);
    const users = await getAllUsers(env.GHL_DB);
    const safe = users.map(({ api_key, ...rest }) => rest);
    return Response.json({ users: safe }, { headers: CORS_HEADERS });
  }

  if (path === "/api/admin/users" && request.method === "POST") {
    await initUsersDb(env.GHL_DB);
    const body = (await request.json()) as { name?: string; email?: string; status?: string; scopes?: string; allowed_accounts?: string; notes?: string };
    if (!body.name || !body.email) return Response.json({ error: "name and email are required" }, { status: 400, headers: CORS_HEADERS });
    if (body.scopes) { try { if (!Array.isArray(JSON.parse(body.scopes))) throw 1; } catch { return Response.json({ error: "scopes must be a JSON array" }, { status: 400, headers: CORS_HEADERS }); } }
    if (body.allowed_accounts) { try { if (!Array.isArray(JSON.parse(body.allowed_accounts))) throw 1; } catch { return Response.json({ error: "allowed_accounts must be a JSON array" }, { status: 400, headers: CORS_HEADERS }); } }
    try {
      const { user, rawApiKey } = await createUserByAdmin(env.GHL_DB, { name: body.name, email: body.email, status: body.status, scopes: body.scopes, allowed_accounts: body.allowed_accounts, notes: body.notes });
      const { api_key, ...safeUser } = user;
      return Response.json({ user: safeUser, api_key: rawApiKey }, { status: 201, headers: CORS_HEADERS });
    } catch (e: any) {
      if (e.message?.includes("UNIQUE")) return Response.json({ error: "A user with this email already exists." }, { status: 409, headers: CORS_HEADERS });
      return Response.json({ error: e.message }, { status: 500, headers: CORS_HEADERS });
    }
  }

  if (path === "/api/admin/accounts" && request.method === "GET") {
    await initDb(env.GHL_DB);
    const result = await env.GHL_DB.prepare("SELECT id, name, account_type, is_default, notes, created_at, updated_at FROM sub_accounts ORDER BY name").all<Omit<SubAccount, "api_key" | "refresh_token" | "expires_at">>();
    return Response.json({ accounts: result.results ?? [] }, { headers: CORS_HEADERS });
  }

  const userMatch = path.match(/^\/api\/admin\/users\/([^/]+)$/);
  if (userMatch) {
    await initUsersDb(env.GHL_DB);
    const userId = userMatch[1];
    if (request.method === "PATCH") {
      const body = (await request.json()) as { status?: string; scopes?: string; allowed_accounts?: string; notes?: string };
      if (body.status && !["active","pending","disabled"].includes(body.status)) return Response.json({ error: "Invalid status" }, { status: 400, headers: CORS_HEADERS });
      if (body.scopes) { try { if (!Array.isArray(JSON.parse(body.scopes))) throw 1; } catch { return Response.json({ error: "scopes must be a JSON array" }, { status: 400, headers: CORS_HEADERS }); } }
      if (body.allowed_accounts) { try { if (!Array.isArray(JSON.parse(body.allowed_accounts))) throw 1; } catch { return Response.json({ error: "allowed_accounts must be a JSON array" }, { status: 400, headers: CORS_HEADERS }); } }
      // LOW-4 fix: verify user exists before updating
      const { getUserById } = await import("../db/users");
      const existing = await getUserById(env.GHL_DB, userId);
      if (!existing) return Response.json({ error: "User not found" }, { status: 404, headers: CORS_HEADERS });
      await updateUser(env.GHL_DB, userId, body);
      return Response.json({ ok: true }, { headers: CORS_HEADERS });
    }
    if (request.method === "DELETE") {
      await deleteUser(env.GHL_DB, userId);
      return Response.json({ ok: true }, { headers: CORS_HEADERS });
    }
  }

  return Response.json({ error: "Not found" }, { status: 404, headers: CORS_HEADERS });
}
