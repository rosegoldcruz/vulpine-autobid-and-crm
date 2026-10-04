/* Twilio Console frontend -- vanilla JS, no build step. */
"use strict";

/* ---------------- helpers ---------------- */
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[c]));

async function api(method, path, body) {
  const opts = { method, headers: {} };
  if (body !== undefined) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(path, opts);
  if (res.status === 401) { showLogin(); throw new Error("Not authenticated"); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || data.error || `HTTP ${res.status}`);
  return data;
}

let toastTimer = null;
function toast(msg, isErr) {
  const el = $("toast");
  el.textContent = msg;
  el.classList.toggle("err", !!isErr);
  el.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add("hidden"), 3500);
}

function showLogin() {
  $("login-overlay").classList.remove("hidden");
  $("main").style.visibility = "hidden";
}
function hideLogin() {
  $("login-overlay").classList.add("hidden");
  $("main").style.visibility = "visible";
}

/* ---------------- tabs ---------------- */
const TAB_LOADERS = {};
document.querySelectorAll("#tabs button").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#tabs button").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    $("tab-" + btn.dataset.tab).classList.add("active");
    const loader = TAB_LOADERS[btn.dataset.tab];
    if (loader) loader().catch((e) => toast(e.message, true));
  });
});

/* ---------------- auth ---------------- */
$("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("login-error").classList.add("hidden");
  try {
    await api("POST", "/api/auth/login", { password: $("login-password").value });
    $("login-password").value = "";
    hideLogin();
    await boot();
  } catch (err) {
    const el = $("login-error");
    el.textContent = err.message;
    el.classList.remove("hidden");
  }
});
$("logout-btn").addEventListener("click", async () => {
  await destroyPhone().catch(() => {});
  await api("POST", "/api/auth/logout").catch(() => {});
  showLogin();
});

/* ---------------- shared state ---------------- */
const state = { accounts: [], numbers: [], defaultAccountId: null };

async function loadAccounts() {
  state.accounts = await api("GET", "/api/accounts");
  const def = state.accounts.find((a) => a.is_default) || state.accounts[0];
  state.defaultAccountId = def ? def.id : null;
  for (const selId of ["phone-account", "numbers-account", "c-account", "messages-account", "calls-account", "recordings-account"]) {
    const sel = $(selId);
    sel.innerHTML = "";
    state.accounts.forEach((a) => {
      const o = document.createElement("option");
      o.value = a.id;
      o.textContent = `${a.label} (${a.account_sid_masked})`;
      if (a.is_default) o.selected = true;
      sel.appendChild(o);
    });
  }
}

/* ---------------- BROWSER PHONE ---------------- */
let voiceDevice = null;
let activeCall = null;
let incomingCall = null;
let callMuted = false;

function setPhoneStatus(label, stateName = "") {
  $("phone-status").textContent = label;
  $("phone-status-dot").className = stateName;
}

function resetCallControls() {
  activeCall = null;
  callMuted = false;
  $("phone-call").disabled = !voiceDevice;
  $("phone-hangup").disabled = true;
  $("phone-mute").disabled = true;
  $("phone-mute").textContent = "Mute";
}

function bindCall(call, direction) {
  activeCall = call;
  $("phone-call").disabled = true;
  $("phone-hangup").disabled = false;
  $("phone-mute").disabled = false;
  setPhoneStatus(direction === "incoming" ? "Connecting incoming call…" : "Calling…", "busy");
  call.on("ringing", () => setPhoneStatus("Ringing…", "busy"));
  call.on("accept", () => setPhoneStatus("On call", "live"));
  call.on("disconnect", () => {
    setPhoneStatus("Phone ready", "ready");
    resetCallControls();
  });
  call.on("cancel", () => {
    setPhoneStatus("Caller hung up", "ready");
    resetCallControls();
  });
  call.on("reject", () => {
    setPhoneStatus("Call declined", "ready");
    resetCallControls();
  });
  call.on("error", (err) => {
    setPhoneStatus("Call error", "error");
    toast(err.message || "The call failed", true);
    resetCallControls();
  });
}

async function destroyPhone() {
  if (voiceDevice) {
    voiceDevice.destroy();
    voiceDevice = null;
  }
  activeCall = null;
  incomingCall = null;
  $("phone-incoming").classList.add("hidden");
  $("phone-enable").disabled = false;
  $("phone-call").disabled = true;
  $("phone-hangup").disabled = true;
  $("phone-mute").disabled = true;
  setPhoneStatus("Not connected");
}

async function loadPhone() {
  await loadAccounts();
  const accountId = $("phone-account").value || state.defaultAccountId;
  if (!accountId) {
    $("phone-setup-copy").textContent = "Add a Twilio account first.";
    $("phone-provision").classList.add("hidden");
    $("phone-enable").disabled = true;
    return;
  }
  const voice = await api("GET", `/api/voice/status?account_id=${accountId}`);
  const from = $("phone-from");
  from.innerHTML = voice.caller_numbers.length
    ? voice.caller_numbers.map((number) => `<option value="${esc(number)}">${esc(number)}</option>`).join("")
    : `<option value="" disabled>No voice-capable numbers synced</option>`;
  if (!voice.public_url_configured) {
    $("phone-setup-copy").textContent = "Set PUBLIC_BASE_URL to this app's public HTTPS address before enabling browser calls.";
    $("phone-provision").classList.add("hidden");
    $("phone-enable").disabled = true;
  } else if (!voice.configured) {
    $("phone-setup-copy").textContent = "This account still needs a TwiML App and API key for Voice SDK access.";
    $("phone-provision").classList.remove("hidden");
    $("phone-enable").disabled = true;
  } else if (!voice.caller_numbers.length) {
    $("phone-setup-copy").textContent = "Voice is configured. Sync a voice-capable Twilio number before calling.";
    $("phone-provision").classList.add("hidden");
    $("phone-enable").disabled = true;
  } else {
    $("phone-setup-copy").textContent = `Ready for ${voice.identity}. Enable the phone when you want to call or receive.`;
    $("phone-provision").classList.add("hidden");
    $("phone-enable").disabled = false;
  }
}

$("phone-provision").addEventListener("click", async () => {
  const accountId = +$("phone-account").value;
  try {
    $("phone-provision").disabled = true;
    $("phone-setup-copy").textContent = "Creating the TwiML App and API key in Twilio…";
    await api("POST", "/api/voice/provision", { account_id: accountId });
    await loadAccounts();
    await loadPhone();
    toast("Browser calling is configured");
  } catch (err) {
    toast(err.message, true);
  } finally {
    $("phone-provision").disabled = false;
  }
});

$("phone-enable").addEventListener("click", async () => {
  const accountId = +$("phone-account").value;
  try {
    if (!window.Twilio?.Device) throw new Error("Twilio Voice SDK did not load");
    $("phone-enable").disabled = true;
    setPhoneStatus("Requesting microphone…", "busy");
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("This browser does not expose microphone access");
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    const tokenData = await api("POST", "/api/voice/token", { account_id: accountId });
    voiceDevice = new Twilio.Device(tokenData.token, {
      closeProtection: true,
      codecPreferences: ["opus", "pcmu"],
      enableRingingState: true,
    });
    voiceDevice.on("registered", () => {
      setPhoneStatus("Phone ready", "ready");
      $("phone-call").disabled = false;
      $("phone-enable").textContent = "Phone enabled";
    });
    voiceDevice.on("registering", () => setPhoneStatus("Connecting to Twilio…", "busy"));
    voiceDevice.on("unregistered", () => setPhoneStatus("Phone offline", "error"));
    voiceDevice.on("error", (err) => {
      setPhoneStatus("Phone error", "error");
      toast(err.message || "Twilio Voice connection failed", true);
    });
    voiceDevice.on("tokenWillExpire", async () => {
      try {
        const fresh = await api("POST", "/api/voice/token", { account_id: +$("phone-account").value });
        voiceDevice?.updateToken(fresh.token);
      } catch (err) { toast("Could not refresh the phone session: " + err.message, true); }
    });
    voiceDevice.on("incoming", (call) => {
      incomingCall = call;
      $("phone-incoming-from").textContent = call.parameters?.From || "Unknown caller";
      $("phone-incoming").classList.remove("hidden");
      setPhoneStatus("Incoming call", "busy");
      call.on("cancel", () => {
        incomingCall = null;
        $("phone-incoming").classList.add("hidden");
        setPhoneStatus("Phone ready", "ready");
      });
    });
    await voiceDevice.register();
  } catch (err) {
    $("phone-enable").disabled = false;
    setPhoneStatus("Not connected", "error");
    toast(err.message, true);
  }
});

$("phone-call").addEventListener("click", async () => {
  const destination = $("phone-to").value.trim();
  if (!/^\+[1-9]\d{7,14}$/.test(destination)) {
    toast("Enter an E.164 number such as +16025551234", true);
    return;
  }
  try {
    const call = await voiceDevice.connect({ params: {
      To: destination,
      FromNumber: $("phone-from").value,
      Record: $("phone-record").checked ? "true" : "false",
    } });
    bindCall(call, "outgoing");
  } catch (err) { toast(err.message, true); }
});

$("phone-answer").addEventListener("click", () => {
  if (!incomingCall) return;
  const call = incomingCall;
  incomingCall = null;
  $("phone-incoming").classList.add("hidden");
  call.accept();
  bindCall(call, "incoming");
});
$("phone-reject").addEventListener("click", () => {
  incomingCall?.reject();
  incomingCall = null;
  $("phone-incoming").classList.add("hidden");
  setPhoneStatus("Phone ready", "ready");
});
$("phone-hangup").addEventListener("click", () => activeCall?.disconnect());
$("phone-mute").addEventListener("click", () => {
  if (!activeCall) return;
  callMuted = !callMuted;
  activeCall.mute(callMuted);
  $("phone-mute").textContent = callMuted ? "Unmute" : "Mute";
});
$("dialpad").querySelectorAll("[data-digit]").forEach((button) => button.addEventListener("click", () => {
  const digit = button.dataset.digit;
  if (activeCall) activeCall.sendDigits(digit);
  else $("phone-to").value += digit;
}));
$("phone-account").addEventListener("change", async () => {
  await destroyPhone();
  await loadPhone().catch((err) => toast(err.message, true));
});

/* ---------------- ACCOUNTS tab ---------------- */
let editingAccountId = null;

function renderAccounts() {
  const box = $("accounts-list");
  if (!state.accounts.length) {
    box.innerHTML = `<div class="card muted">No accounts yet. Add your Twilio account to get started.</div>`;
    return;
  }
  box.innerHTML = state.accounts.map((a) => `
    <div class="item">
      <div class="item-head">
        <div>
          <span class="item-title">${esc(a.label)}</span>
          ${a.is_default ? `<span class="badge ok">default</span>` : ""}
          ${a.voice_configured ? `<span class="badge ok">browser voice ready</span>` : ""}
          <div class="muted small mono">SID ${esc(a.account_sid_masked)} · Token ${esc(a.auth_token_masked)}</div>
        </div>
        <div class="item-actions">
          <button class="btn sm" data-act="test" data-id="${a.id}">Test connection</button>
          <button class="btn sm" data-act="edit" data-id="${a.id}">Edit</button>
          <button class="btn sm danger" data-act="del" data-id="${a.id}">Delete</button>
        </div>
      </div>
      <div class="muted small" id="acct-msg-${a.id}"></div>
    </div>`).join("");
  box.querySelectorAll("button").forEach((b) => b.addEventListener("click", onAccountAction));
}

async function onAccountAction(e) {
  const id = +e.target.dataset.id, act = e.target.dataset.act;
  if (act === "del") {
    if (!confirm("Delete this account and its cached numbers?")) return;
    await api("DELETE", `/api/accounts/${id}`);
    toast("Account deleted");
  } else if (act === "test") {
    const msg = $("acct-msg-" + id);
    msg.textContent = "Testing…";
    const r = await api("POST", `/api/accounts/${id}/test`);
    msg.innerHTML = r.ok
      ? `<span class="badge ok">Connected</span> ${esc(r.friendly_name || "")} (${esc(r.status || "")})`
      : `<span class="badge bad">Failed</span> ${esc(r.error || "")}`;
    return;
  } else if (act === "edit") {
    const a = state.accounts.find((x) => x.id === id);
    editingAccountId = id;
    $("af-title").textContent = "Edit account";
    $("af-label").value = a.label;
    $("af-sid").value = "";
    $("af-sid").placeholder = a.account_sid_masked + " (SID can't be changed — delete + re-add instead)";
    $("af-sid").disabled = true;
    $("af-token").value = "";
    $("af-token").placeholder = "Leave blank to keep current token";
    $("af-api-key-sid").value = "";
    $("af-api-key-sid").placeholder = a.api_key_sid_masked || "Leave blank to keep current key";
    $("af-api-key-secret").value = "";
    $("af-api-key-secret").placeholder = a.voice_configured ? "Leave blank to keep current secret" : "";
    $("af-twiml-app-sid").value = "";
    $("af-twiml-app-sid").placeholder = a.twiml_app_sid_masked || "Leave blank to keep current app";
    $("af-default").checked = a.is_default;
    $("account-form").classList.remove("hidden");
    return;
  }
  await loadAccounts(); renderAccounts();
}

$("account-new-open").addEventListener("click", () => {
  editingAccountId = null;
  $("af-title").textContent = "Add account";
  $("af-label").value = ""; $("af-sid").value = "";
  $("af-sid").disabled = false; $("af-sid").placeholder = "AC...";
  $("af-token").value = ""; $("af-token").placeholder = "";
  $("af-api-key-sid").value = ""; $("af-api-key-sid").placeholder = "SK…";
  $("af-api-key-secret").value = ""; $("af-api-key-secret").placeholder = "";
  $("af-twiml-app-sid").value = ""; $("af-twiml-app-sid").placeholder = "AP…";
  $("af-default").checked = state.accounts.length === 0;
  $("account-form").classList.remove("hidden");
});
$("af-cancel").addEventListener("click", () => $("account-form").classList.add("hidden"));
$("af-save").addEventListener("click", async () => {
  const payload = {
    label: $("af-label").value.trim() || "Twilio",
    account_sid: $("af-sid").value.trim(),
    auth_token: $("af-token").value,
    api_key_sid: $("af-api-key-sid").value.trim(),
    api_key_secret: $("af-api-key-secret").value,
    twiml_app_sid: $("af-twiml-app-sid").value.trim(),
    is_default: $("af-default").checked,
  };
  try {
    if (editingAccountId) {
      const upd = { label: payload.label, is_default: payload.is_default };
      if (payload.auth_token) upd.auth_token = payload.auth_token;
      if (payload.api_key_sid) upd.api_key_sid = payload.api_key_sid;
      if (payload.api_key_secret) upd.api_key_secret = payload.api_key_secret;
      if (payload.twiml_app_sid) upd.twiml_app_sid = payload.twiml_app_sid;
      await api("PUT", `/api/accounts/${editingAccountId}`, upd);
    } else {
      if (!payload.account_sid || !payload.auth_token) throw new Error("SID and auth token are required");
      await api("POST", "/api/accounts", payload);
    }
    $("account-form").classList.add("hidden");
    await loadAccounts(); renderAccounts();
    toast("Account saved");
  } catch (err) { toast(err.message, true); }
});

/* ---------------- NUMBERS tab ---------------- */
let activeNumber = null; // phone_number string being configured

async function loadNumbers() {
  const accountId = $("numbers-account").value || state.defaultAccountId;
  if (!accountId) { $("numbers-list").innerHTML = `<div class="card muted">Add a Twilio account first.</div>`; return; }
  $("numbers-list").innerHTML = `<div class="card muted">Syncing with Twilio…</div>`;
  state.numbers = await api("GET", `/api/numbers?account_id=${accountId}`);
  renderNumbers();
}

function renderNumbers() {
  const box = $("numbers-list");
  if (!state.numbers.length) {
    box.innerHTML = `<div class="card muted">No numbers on this account. Buy one below.</div>`;
    return;
  }
  box.innerHTML = state.numbers.map((n) => `
    <div class="item">
      <div class="item-head">
        <div>
          <span class="item-title mono">${esc(n.phone_number)}</span>
          ${n.sms_capable ? `<span class="badge ok">SMS</span>` : `<span class="badge">no SMS</span>`}
          ${n.voice_capable ? `<span class="badge ok">Voice</span>` : `<span class="badge">no voice</span>`}
          ${n.is_default_sender ? `<span class="badge warn">default sender</span>` : ""}
          ${n.webhook_applied ? `<span class="badge ok">webhooks set</span>` : `<span class="badge bad">webhooks not set</span>`}
        </div>
        <div class="item-actions">
          <button class="btn sm" data-act="cfg" data-num="${esc(n.phone_number)}">Configure</button>
          <button class="btn sm" data-act="webhooks" data-num="${esc(n.phone_number)}">Apply webhooks</button>
          <button class="btn sm" data-act="default" data-num="${esc(n.phone_number)}">Set as sender</button>
          <button class="btn sm danger" data-act="release" data-sid="${esc(n.number_sid)}" data-num="${esc(n.phone_number)}">Release</button>
        </div>
      </div>
    </div>`).join("");
  box.querySelectorAll("button").forEach((b) => b.addEventListener("click", onNumberAction));
}

async function onNumberAction(e) {
  const accountId = $("numbers-account").value;
  const num = e.target.dataset.num, act = e.target.dataset.act;
  try {
    if (act === "default") {
      await api("POST", "/api/numbers/default", { account_id: +accountId, phone_number: num });
      toast(`${num} is now the default sender`);
    } else if (act === "webhooks") {
      await api("POST", "/api/numbers/apply-webhooks", { account_id: +accountId, phone_number: num });
      toast(`Webhooks applied to ${num}`);
    } else if (act === "release") {
      if (!confirm(`Release ${num}? This gives the number back to Twilio.`)) return;
      await api("POST", `/api/numbers/${e.target.dataset.sid}/release`, { account_id: +accountId });
      toast(`${num} released`);
    } else if (act === "cfg") {
      await openNumberConfig(num);
      return;
    }
    await loadNumbers();
  } catch (err) { toast(err.message, true); }
}

async function openNumberConfig(num) {
  activeNumber = num;
  const s = await api("GET", `/api/settings/number?phone_number=${encodeURIComponent(num)}`);
  $("nd-number").textContent = num;
  $("ns-auto-reply-enabled").checked = s.auto_reply_enabled;
  $("ns-auto-reply-text").value = s.auto_reply_text;
  $("ns-forwarding-enabled").checked = s.forwarding_enabled;
  $("ns-forward-to").value = s.forward_to;
  $("ns-record-calls").checked = s.record_calls;
  $("ns-browser-ringing").checked = s.browser_ringing_enabled;
  $("ns-missed-alert").checked = s.missed_call_alert;
  $("ns-alert-number").value = s.alert_notify_number;
  $("ns-voicemail-enabled").checked = s.voicemail_enabled;
  $("ns-voicemail-greeting").value = s.voicemail_greeting;
  $("number-detail").classList.remove("hidden");
  $("number-detail").scrollIntoView({ behavior: "smooth", block: "nearest" });
}
$("ns-close").addEventListener("click", () => $("number-detail").classList.add("hidden"));
$("ns-save").addEventListener("click", async () => {
  try {
    await api("PUT", "/api/settings/number", {
      phone_number: activeNumber,
      auto_reply_enabled: $("ns-auto-reply-enabled").checked,
      auto_reply_text: $("ns-auto-reply-text").value,
      forwarding_enabled: $("ns-forwarding-enabled").checked,
      forward_to: $("ns-forward-to").value,
      record_calls: $("ns-record-calls").checked,
      browser_ringing_enabled: $("ns-browser-ringing").checked,
      missed_call_alert: $("ns-missed-alert").checked,
      alert_notify_number: $("ns-alert-number").value,
      voicemail_enabled: $("ns-voicemail-enabled").checked,
      voicemail_greeting: $("ns-voicemail-greeting").value,
    });
    toast("Settings saved for " + activeNumber);
  } catch (err) { toast(err.message, true); }
});

/* Buy number */
$("numbers-buy-open").addEventListener("click", () => {
  $("buy-box").classList.toggle("hidden");
});
$("buy-search").addEventListener("click", async () => {
  const accountId = $("numbers-account").value;
  const area = $("buy-area").value.trim();
  if (!/^\d{3}$/.test(area)) { toast("Enter a 3-digit area code", true); return; }
  try {
    const results = await api("GET", `/api/numbers/available?account_id=${accountId}&area_code=${area}`);
    $("buy-results").innerHTML = results.length
      ? results.map((r) => `
        <div class="item-head">
          <span class="mono">${esc(r.phone_number)}</span>
          <button class="btn sm primary" data-buy="${esc(r.phone_number)}">Buy</button>
        </div>`).join("")
      : `<div class="muted">No numbers found for ${esc(area)}.</div>`;
    $("buy-results").querySelectorAll("[data-buy]").forEach((b) =>
      b.addEventListener("click", async () => {
        if (!confirm(`Buy ${b.dataset.buy}? Twilio will charge your account.`)) return;
        try {
          await api("POST", "/api/numbers/buy", { account_id: +accountId, phone_number: b.dataset.buy });
          toast(`Purchased ${b.dataset.buy} (webhooks applied)`);
          $("buy-box").classList.add("hidden");
          await loadNumbers();
        } catch (err) { toast(err.message, true); }
      }));
  } catch (err) { toast(err.message, true); }
});

$("numbers-refresh").addEventListener("click", () => loadNumbers().catch((e) => toast(e.message, true)));
$("numbers-account").addEventListener("change", () => loadNumbers().catch((e) => toast(e.message, true)));

/* ---------------- CAMPAIGNS tab ---------------- */
let previewCampaignId = null;

async function loadCampaignForm() {
  const acctSel = $("c-account");
  acctSel.innerHTML = "";
  state.accounts.forEach((a) => {
    const o = document.createElement("option");
    o.value = a.id; o.textContent = `${a.label} (${a.account_sid_masked})`;
    if (a.is_default) o.selected = true;
    acctSel.appendChild(o);
  });
  await refreshFromNumbers();
}
async function refreshFromNumbers() {
  const accountId = $("c-account").value;
  const sel = $("c-from");
  sel.innerHTML = "";
  if (!accountId) return;
  const nums = await api("GET", `/api/numbers?account_id=${accountId}`).catch(() => []);
  const smsNums = nums.filter((n) => n.sms_capable);
  smsNums.forEach((n) => {
    const o = document.createElement("option");
    o.value = n.phone_number; o.textContent = n.phone_number + (n.is_default_sender ? " (default)" : "");
    if (n.is_default_sender) o.selected = true;
    sel.appendChild(o);
  });
  if (!smsNums.length) {
    const o = document.createElement("option");
    o.textContent = "No SMS-capable numbers"; o.disabled = true;
    sel.appendChild(o);
  }
}
$("c-account").addEventListener("change", () => refreshFromNumbers().catch((e) => toast(e.message, true)));

function statusBadge(s) {
  const cls = { draft: "", running: "warn", done: "ok", cancelled: "bad", interrupted: "bad" }[s] || "";
  return `<span class="badge ${cls}">${esc(s)}</span>`;
}

async function loadCampaigns() {
  const list = await api("GET", "/api/campaigns");
  const box = $("campaigns-list");
  if (!list.length) {
    box.innerHTML = `<div class="card muted">No campaigns yet.</div>`;
    return;
  }
  box.innerHTML = list.map((c) => {
    const pct = c.total ? Math.round(((c.sent_count + c.failed_count) / c.total) * 100) : 0;
    return `
    <div class="item">
      <div class="item-head">
        <div>
          <span class="item-title">${esc(c.name)}</span> ${statusBadge(c.status)}
          <div class="muted small">${esc(c.from_number)} · ${c.total} recipients · ${c.rate_per_sec}/s</div>
        </div>
        <div class="item-actions">
          <button class="btn sm" data-act="view" data-id="${c.id}">View</button>
          ${c.status === "running" ? `<button class="btn sm danger" data-act="cancel" data-id="${c.id}">Cancel</button>` : ""}
          ${["draft", "interrupted", "cancelled"].includes(c.status) ? `<button class="btn sm primary" data-act="launch" data-id="${c.id}">Launch</button>` : ""}
          <button class="btn sm danger" data-act="del" data-id="${c.id}">Delete</button>
        </div>
      </div>
      <div class="progress"><div style="width:${pct}%"></div></div>
      <div class="muted small">${c.sent_count} sent · ${c.failed_count} failed · ${c.total} total</div>
    </div>`;
  }).join("");
  box.querySelectorAll("button").forEach((b) => b.addEventListener("click", onCampaignAction));
}

async function onCampaignAction(e) {
  const id = +e.target.dataset.id, act = e.target.dataset.act;
  try {
    if (act === "del") {
      if (!confirm("Delete this campaign and its recipient list?")) return;
      await api("DELETE", `/api/campaigns/${id}`);
      toast("Campaign deleted");
    } else if (act === "launch") {
      if (!confirm("Launch this campaign now? Messages will be sent at the configured rate.")) return;
      await api("POST", `/api/campaigns/${id}/launch`);
      toast("Campaign launched");
    } else if (act === "cancel") {
      await api("POST", `/api/campaigns/${id}/cancel`);
      toast("Campaign cancelled");
    } else if (act === "view") {
      await openCampaignDetail(id);
      return;
    }
    await loadCampaigns();
  } catch (err) { toast(err.message, true); }
}

async function openCampaignDetail(id) {
  const c = await api("GET", `/api/campaigns/${id}`);
  $("cd-name").textContent = c.name;
  $("cd-body").innerHTML = `
    <div class="muted small">From ${esc(c.from_number)} · ${statusBadge(c.status)} · ${c.rate_per_sec}/s</div>
    <blockquote>${esc(c.message)}</blockquote>
    ${c.media_urls.length ? `<div class="small muted">Media: ${c.media_urls.map(esc).join(", ")}</div>` : ""}
    <div class="progress"><div style="width:${c.total ? Math.round(((c.sent_count + c.failed_count) / c.total) * 100) : 0}%"></div></div>
    <div class="recipients"><table>
      <tr><th>To</th><th>Status</th><th>Twilio SID</th><th>Error</th></tr>
      ${c.recipients.map((r) => `<tr><td class="mono">${esc(r.to_number)}</td><td>${esc(r.status)}</td><td class="mono">${esc(r.twilio_sid)}</td><td class="small">${esc(r.error)}</td></tr>`).join("")}
    </table></div>`;
  $("campaign-detail").classList.remove("hidden");
  $("campaign-detail").scrollIntoView({ behavior: "smooth", block: "nearest" });
}
$("cd-close").addEventListener("click", () => $("campaign-detail").classList.add("hidden"));

$("campaign-new-open").addEventListener("click", async () => {
  $("campaign-form").classList.toggle("hidden");
  await loadCampaignForm().catch((e) => toast(e.message, true));
});
$("c-cancel-form").addEventListener("click", () => $("campaign-form").classList.add("hidden"));

$("c-create").addEventListener("click", async () => {
  try {
    const c = await api("POST", "/api/campaigns", {
      name: $("c-name").value.trim(),
      account_id: +$("c-account").value,
      from_number: $("c-from").value,
      message: $("c-message").value,
      media_urls: $("c-media").value.split("\n").map((s) => s.trim()).filter(Boolean),
      recipients_text: $("c-recipients").value,
      rate_per_sec: $("c-rate").value ? parseFloat($("c-rate").value) : null,
    });
    previewCampaignId = c.id;
    $("campaign-form").classList.add("hidden");
    $("cp-body").innerHTML = `
      <div class="item-head"><b>${esc(c.name)}</b> ${statusBadge(c.status)}</div>
      <div class="muted small">From <span class="mono">${esc(c.from_number)}</span> · ${c.total} recipients (${c.skipped || 0} invalid skipped) · ${c.rate_per_sec} msg/s</div>
      <blockquote>${esc(c.message)}</blockquote>
      ${c.media_urls.length ? `<div class="small">MMS media: ${c.media_urls.map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(u)}</a>`).join("<br>")}</div>` : ""}
      <p class="muted small">Launching sends real messages via Twilio and may incur charges.</p>`;
    $("campaign-preview").classList.remove("hidden");
    $("campaign-preview").scrollIntoView({ behavior: "smooth" });
  } catch (err) { toast(err.message, true); }
});
$("cp-discard").addEventListener("click", async () => {
  if (previewCampaignId) await api("DELETE", `/api/campaigns/${previewCampaignId}`).catch(() => {});
  previewCampaignId = null;
  $("campaign-preview").classList.add("hidden");
});
$("cp-launch").addEventListener("click", async () => {
  if (!previewCampaignId) return;
  if (!confirm("Launch now? This sends real messages.")) return;
  try {
    await api("POST", `/api/campaigns/${previewCampaignId}/launch`);
    previewCampaignId = null;
    $("campaign-preview").classList.add("hidden");
    await loadCampaigns();
    toast("Campaign launched");
  } catch (err) { toast(err.message, true); }
});

/* ---------------- MESSAGES tab ---------------- */
async function loadMessages() {
  const accountId = $("messages-account").value || state.defaultAccountId;
  if (!accountId) { $("messages-list").innerHTML = `<div class="card muted">Add a Twilio account first.</div>`; return; }
  const [msgs, nums] = await Promise.all([
    api("GET", `/api/messages?account_id=${accountId}&limit=100`),
    api("GET", `/api/numbers?account_id=${accountId}`).catch(() => []),
  ]);
  const senders = nums.filter((number) => number.sms_capable);
  $("message-from").innerHTML = senders.length
    ? senders.map((number) => `<option value="${esc(number.phone_number)}" ${number.is_default_sender ? "selected" : ""}>${esc(number.phone_number)}${number.is_default_sender ? " (default)" : ""}</option>`).join("")
    : `<option value="" disabled>No SMS-capable numbers</option>`;
  const box = $("messages-list");
  box.innerHTML = msgs.length ? msgs.map((m) => `
    <div class="item">
      <div class="item-head">
        <div>
          <span class="item-title mono">${esc(m.from_number)}</span>
          <span class="muted small">→ <span class="mono">${esc(m.to_number)}</span></span>
          <span class="badge ${m.status === "failed" || m.status === "undelivered" ? "bad" : m.status === "delivered" || m.status === "received" ? "ok" : ""}">${esc(m.status || m.direction)}</span>
          ${m.num_media ? `<span class="badge">${m.num_media} media</span>` : ""}
        </div>
        <div class="item-actions">
          <span class="muted small">${esc(m.date || "")}</span>
          <button class="btn sm" data-reply="${esc(m.direction === "inbound" ? m.from_number : m.to_number)}">Reply</button>
        </div>
      </div>
      <blockquote>${esc(m.body)}</blockquote>
      ${m.error_message ? `<div class="error small">${esc(m.error_message)} (${esc(m.error_code)})</div>` : ""}
    </div>`).join("")
    : `<div class="card muted">No messages found on this account.</div>`;
  box.querySelectorAll("[data-reply]").forEach((b) => b.addEventListener("click", () => {
    $("message-to").value = b.dataset.reply;
    $("message-body").focus();
    $("message-body").scrollIntoView({ behavior: "smooth", block: "center" });
  }));
}
$("messages-refresh").addEventListener("click", () => loadMessages().catch((e) => toast(e.message, true)));
$("messages-account").addEventListener("change", () => loadMessages().catch((e) => toast(e.message, true)));
$("message-send").addEventListener("click", async () => {
  try {
    $("message-send").disabled = true;
    await api("POST", "/api/messages/send", {
      account_id: +$("messages-account").value,
      from_number: $("message-from").value,
      to_number: $("message-to").value.trim(),
      body: $("message-body").value,
      media_urls: $("message-media").value.split("\n").map((value) => value.trim()).filter(Boolean),
    });
    $("message-body").value = "";
    $("message-media").value = "";
    toast("Message queued by Twilio");
    await loadMessages();
  } catch (err) { toast(err.message, true); }
  finally { $("message-send").disabled = false; }
});

/* ---------------- CALL HISTORY tab ---------------- */
async function loadCalls() {
  const accountId = $("calls-account").value || state.defaultAccountId;
  if (!accountId) { $("calls-list").innerHTML = `<div class="card muted">Add a Twilio account first.</div>`; return; }
  const calls = await api("GET", `/api/voice/calls?account_id=${accountId}&limit=100`);
  const box = $("calls-list");
  box.innerHTML = calls.length ? calls.map((call) => `
    <div class="item call-row">
      <div class="item-head">
        <div>
          <span class="direction-icon">${call.direction?.startsWith("inbound") ? "↙" : "↗"}</span>
          <span class="item-title mono">${esc(call.from_number)}</span>
          <span class="muted small">→ <span class="mono">${esc(call.to_number)}</span></span>
          <span class="badge ${call.status === "completed" ? "ok" : ["failed", "busy", "no-answer", "canceled"].includes(call.status) ? "bad" : "warn"}">${esc(call.status)}</span>
        </div>
        <span class="muted small">${esc(call.start_time || "")}</span>
      </div>
      <div class="muted small">${call.duration ? `${esc(call.duration)} seconds` : "No connected duration"}${call.price ? ` · ${esc(call.price)} ${esc(call.price_unit || "")}` : ""}</div>
    </div>`).join("") : `<div class="card muted">No calls found on this account.</div>`;
}
$("calls-refresh").addEventListener("click", () => loadCalls().catch((e) => toast(e.message, true)));
$("calls-account").addEventListener("change", () => loadCalls().catch((e) => toast(e.message, true)));

/* ---------------- VOICEMAIL tab ---------------- */
async function loadVoicemails() {
  const vms = await api("GET", "/api/voicemails");
  const box = $("vm-list");
  box.innerHTML = vms.length ? vms.map((v) => `
    <div class="item">
      <div class="item-head">
        <div>
          <span class="item-title mono">${esc(v.from_number)}</span>
          <span class="muted small">→ <span class="mono">${esc(v.number)}</span></span>
          ${v.listened ? "" : `<span class="badge warn">new</span>`}
        </div>
        <div class="item-actions">
          <span class="muted small">${esc(v.received_at || "")}</span>
          <button class="btn sm danger" data-del="${v.id}">Delete</button>
        </div>
      </div>
      ${v.transcription ? `<div class="transcription">“${esc(v.transcription)}”</div>` : `<div class="muted small">No transcription.</div>`}
      <audio controls preload="none" src="/api/voicemails/${v.id}/audio"
             onplay="fetch('/api/voicemails/${v.id}/listened', {method:'POST'})"></audio>
    </div>`).join("")
    : `<div class="card muted">No voicemails yet.</div>`;
  box.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", async () => {
    if (!confirm("Delete this voicemail (also from Twilio)?")) return;
    await api("DELETE", `/api/voicemails/${b.dataset.del}`);
    loadVoicemails().catch((e) => toast(e.message, true));
  }));
}
$("vm-refresh").addEventListener("click", () => loadVoicemails().catch((e) => toast(e.message, true)));

/* ---------------- RECORDINGS tab ---------------- */
async function loadRecordings() {
  const accountId = $("recordings-account").value || state.defaultAccountId;
  if (!accountId) { $("recordings-list").innerHTML = `<div class="card muted">Add a Twilio account first.</div>`; return; }
  const recs = await api("GET", `/api/recordings?account_id=${accountId}&limit=50`);
  const box = $("recordings-list");
  box.innerHTML = recs.length ? recs.map((r) => `
    <div class="item">
      <div class="item-head">
        <div>
          <span class="item-title mono">${esc(r.sid)}</span>
          <div class="muted small">Call ${esc(r.call_sid || "")} · ${esc(r.duration || "?")}s · ${esc(r.date_created || "")}</div>
        </div>
        <div class="item-actions">
          <button class="btn sm danger" data-del="${esc(r.sid)}">Delete</button>
        </div>
      </div>
      <audio controls preload="none" src="/api/recordings/${esc(r.sid)}/audio?account_id=${accountId}"></audio>
    </div>`).join("")
    : `<div class="card muted">No recordings found.</div>`;
  box.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", async () => {
    if (!confirm("Delete this recording from Twilio?")) return;
    await api("DELETE", `/api/recordings/${b.dataset.del}?account_id=${accountId}`);
    loadRecordings().catch((e) => toast(e.message, true));
  }));
}
$("recordings-refresh").addEventListener("click", () => loadRecordings().catch((e) => toast(e.message, true)));
$("recordings-account").addEventListener("change", () => loadRecordings().catch((e) => toast(e.message, true)));

/* ---------------- SETTINGS tab ---------------- */
async function loadSettings() {
  const g = await api("GET", "/api/settings/global");
  $("set-rate").value = g.default_sms_per_sec;
  const base = window.location.origin;
  $("wh-sms").textContent = base + "/webhooks/sms";
  $("wh-voice").textContent = base + "/webhooks/voice";
  $("wh-browser-voice").textContent = base + "/webhooks/browser-voice";
}
$("set-save").addEventListener("click", async () => {
  try {
    await api("PUT", "/api/settings/global", { default_sms_per_sec: parseFloat($("set-rate").value) || 1.0 });
    toast("Settings saved");
  } catch (err) { toast(err.message, true); }
});

/* ---------------- boot ---------------- */
Object.assign(TAB_LOADERS, {
  phone: loadPhone,
  numbers: async () => { await loadAccounts(); await loadNumbers(); },
  campaigns: async () => { await loadAccounts(); await loadCampaigns(); },
  messages: async () => { await loadAccounts(); await loadMessages(); },
  calls: async () => { await loadAccounts(); await loadCalls(); },
  voicemail: loadVoicemails,
  recordings: async () => { await loadAccounts(); await loadRecordings(); },
  accounts: async () => { await loadAccounts(); renderAccounts(); },
  settings: loadSettings,
});

async function boot() {
  try {
    const session = await api("GET", "/api/auth/me");
    if (!session.ok) { showLogin(); return; }
  } catch (e) {
    showLogin();
    return;
  }
  hideLogin();
  await loadAccounts().catch(() => {});
  renderAccounts();
  await TAB_LOADERS.phone().catch((e) => toast(e.message, true));
}

document.addEventListener("DOMContentLoaded", boot);
