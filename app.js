// ── CONFIG ──────────────────────────────────────────────────────────────────
const SUPA_URL = 'https://orfhhiyaigeokebwglkb.supabase.co';
const SUPA_KEY = 'sb_publishable_BsLkDNVCE4FrJ-P4i5eGIw_euUo4SNm';
const { createClient } = supabase;
const sb = createClient(SUPA_URL, SUPA_KEY);

// ── STATE ────────────────────────────────────────────────────────────────────
let currentUser = null;
let currentRole = 'public'; // 'teacher' | 'admin' | 'public'
let notices = [];
let feedbackItems = [];
let circulars = [];
let noticeFilter = 'All';
let activeFeedbackId = null;
let splashStart = Date.now();

// ── PWA MANIFEST ─────────────────────────────────────────────────────────────
const manifest = {
  name: 'JMS-N',
  short_name: 'JMS-N',
  description: 'Jewel Model School Notice',
  start_url: './',
  display: 'standalone',
  background_color: '#0d1e3a',
  theme_color: '#0d1e3a',
  orientation: 'portrait',
  icons: [{
    src: "data:image/svg+xml," + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 192 192'><rect width='192' height='192' rx='32' fill='#0d1e3a'/><text x='96' y='120' font-size='48' font-family='Georgia' font-weight='bold' fill='#c9a44a' text-anchor='middle'>JMS-N</text></svg>`),
    sizes: '192x192',
    type: 'image/svg+xml',
    purpose: 'any maskable'
  }]
};
document.getElementById('pwa-manifest').href = URL.createObjectURL(new Blob([JSON.stringify(manifest)], { type: 'application/json' }));

// ── INIT ──────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  await checkSession();
});

async function checkSession() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    currentUser = session.user;
    await loadUserRole();
    hideLoading();
    showApp();
  } else {
    hideLoading();
    showWelcome();
  }
}

function showWelcome() {
  document.getElementById('welcomeScreen').classList.remove('hidden');
  document.getElementById('authScreen').classList.add('hidden');
  document.getElementById('app').classList.add('hidden');
}

function showStaffLogin() {
  document.getElementById('welcomeScreen').classList.add('hidden');
  document.getElementById('authScreen').classList.remove('hidden');
}

function enterAsPublic() {
  currentRole = 'public';
  currentUser = null;
  document.getElementById('welcomeScreen').classList.add('hidden');
  showApp();
}

function hideLoading() {
  const elapsed = Date.now() - splashStart;
  const delay = Math.max(0, 3000 - elapsed);
  setTimeout(() => document.getElementById('loading').classList.add('hidden'), delay);
}

function showAuthScreen() {
  document.getElementById('authScreen').classList.remove('hidden');
}

function showApp() {
  document.getElementById('authScreen').classList.add('hidden');
  document.getElementById('welcomeScreen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  const isStaff = currentRole === 'admin' || currentRole === 'teacher';
  const roleLabel = currentRole === 'admin' ? 'Admin' : currentRole === 'teacher' ? 'Teacher' : 'Parent';
  document.getElementById('headerRole').textContent = roleLabel;
  document.getElementById('addNoticeBtn').style.display = isStaff ? 'block' : 'none';
  document.getElementById('addCircularBtn').style.display = isStaff ? 'block' : 'none';
  document.getElementById('viewFeedbackBtn').style.display = isStaff ? 'block' : 'none';
  loadNotices();
  loadCirculars();
}

async function loadUserRole() {
  try {
    const { data } = await sb.from('profiles').select('role').eq('id', currentUser.id).single();
    currentRole = data?.role || 'teacher';
  } catch (e) {
    currentRole = 'teacher';
  }
}

// ── AUTH ──────────────────────────────────────────────────────────────────────
async function signIn() {
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  if (!email || !password) { showAuthError('Please enter email and password'); return; }
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) { showAuthError(error.message); return; }
  const { data: { session } } = await sb.auth.getSession();
  currentUser = session.user;
  await loadUserRole();
  showApp();
}

function showAuthError(msg) {
  const el = document.getElementById('authError');
  el.textContent = msg;
  el.classList.remove('hidden');
}

async function signOut() {
  if (currentRole !== 'public') {
    await sb.auth.signOut();
  }
  currentUser = null;
  currentRole = 'public';
  document.getElementById('app').classList.add('hidden');
  showWelcome();
}

function showForgotPassword() {
  const email = prompt('Enter your email address:');
  if (!email) return;
  sb.auth.resetPasswordForEmail(email).then(() => toast('Password reset email sent'));
}

// ── VIEWS ────────────────────────────────────────────────────────────────────
const VIEWS = ['vNotices', 'vFeedback', 'vCirculars'];

function switchView(idx) {
  VIEWS.forEach((v, i) => {
    document.getElementById(v).classList.toggle('on', i === idx);
    document.getElementById('bb' + i).classList.toggle('active', i === idx);
  });
  if (idx === 1) loadFeedback();
  if (idx === 2) loadCirculars();
}

// ── TOAST ────────────────────────────────────────────────────────────────────
let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 3000);
}

// ── MODAL HELPERS ─────────────────────────────────────────────────────────────
function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

// ── NOTICES ───────────────────────────────────────────────────────────────────
async function loadNotices() {
  const { data, error } = await sb.from('notices').select('*').order('created_at', { ascending: false });
  if (error) { toast('Failed to load notices'); return; }
  notices = data || [];
  renderNotices();
}

function filterNotices(cat, btn) {
  noticeFilter = cat;
  document.querySelectorAll('.cat-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderNotices();
}

function renderNotices() {
  const list = document.getElementById('noticesList');
  const filtered = noticeFilter === 'All' ? notices : notices.filter(n => n.category === noticeFilter);
  if (!filtered.length) {
    list.innerHTML = '<div class="notices-empty">No notices yet.</div>';
    return;
  }
  list.innerHTML = filtered.map(n => {
    const date = new Date(n.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const catClass = n.category.toLowerCase();
    return `
      <div class="notice-card ${catClass}" onclick="openNoticeDetail('${n.id}')">
        <div class="notice-card-header">
          <div class="notice-title">${n.title}</div>
          <span class="notice-cat-badge cat-badge-${catClass}">${n.category}</span>
        </div>
        <div class="notice-preview">${n.body}</div>
        <div class="notice-footer">
          <span class="notice-author">${n.author}</span>
          <span class="notice-date">${date}</span>
        </div>
      </div>
    `;
  }).join('');
}

function openNoticeModal() {
  document.getElementById('noticeTitle').value = '';
  document.getElementById('noticeBody').value = '';
  document.getElementById('noticeCategory').value = 'General';
  document.getElementById('noticeSms').checked = true;
  document.getElementById('noticeModal').classList.remove('hidden');
}

function closeNoticeModal() {
  document.getElementById('noticeModal').classList.add('hidden');
}

async function saveNotice() {
  const title = document.getElementById('noticeTitle').value.trim();
  const body = document.getElementById('noticeBody').value.trim();
  const category = document.getElementById('noticeCategory').value;
  const sendSms = document.getElementById('noticeSms').checked;
  if (!title || !body) { toast('Please fill in title and body'); return; }
  const author = currentUser?.email?.split('@')[0] || 'Staff';
  const { data, error } = await sb.from('notices').insert({
    title, body, category, author,
    author_id: currentUser?.id,
    sms_sent: false
  }).select().single();
  if (error) { toast('Failed to post notice'); return; }
  notices.unshift(data);
  renderNotices();
  closeNoticeModal();
  toast('✅ Notice posted');
  if (sendSms) await sendNoticeSms(data);
}

async function sendNoticeSms(notice) {
  // Get all parent numbers from fees table
  const { data: feeData } = await sb.from('fees').select('parent_phone').not('parent_phone', 'is', null).neq('parent_phone', '');
  if (!feeData || !feeData.length) return;
  const phones = [...new Set(feeData.map(f => f.parent_phone).filter(Boolean))];
  const message = `[${notice.category}] ${notice.title}: ${notice.body.slice(0, 100)}${notice.body.length > 100 ? '...' : ''} — Jewel Model Primary School`;
  let sent = 0;
  for (const phone of phones) {
    try {
      await fetch(`${SUPA_URL}/functions/v1/send-sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPA_KEY}` },
        body: JSON.stringify({ to: phone, message, provider: 'kudisms' })
      });
      sent++;
    } catch (e) { console.warn('SMS failed for', phone); }
  }
  await sb.from('notices').update({ sms_sent: true }).eq('id', notice.id);
  toast(`📨 SMS sent to ${sent} parents`);
}

function openNoticeDetail(id) {
  const n = notices.find(x => x.id === id);
  if (!n) return;
  const date = new Date(n.created_at).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  document.getElementById('ndTitle').textContent = n.title;
  document.getElementById('ndMeta').textContent = `${n.category} · ${n.author} · ${date}`;
  document.getElementById('ndBody').textContent = n.body;
  const actions = document.getElementById('ndActions');
  const isStaff = currentRole === 'admin' || currentRole === 'teacher';
  const isAuthor = n.author_id === currentUser?.id;
  actions.innerHTML = isStaff && isAuthor
    ? `<button class="nd-action-btn danger" onclick="deleteNotice('${n.id}')">🗑 Delete</button>`
    : '';
  document.getElementById('noticeDetailModal').classList.remove('hidden');
}

async function deleteNotice(id) {
  if (!confirm('Delete this notice?')) return;
  await sb.from('notices').delete().eq('id', id);
  notices = notices.filter(n => n.id !== id);
  renderNotices();
  closeModal('noticeDetailModal');
  toast('Notice deleted');
}

// ── FEEDBACK ──────────────────────────────────────────────────────────────────
async function loadFeedback() {
  const isStaff = currentRole === 'admin' || currentRole === 'teacher';
  if (!isStaff) return;
  const { data } = await sb.from('feedback').select('*').order('created_at', { ascending: false });
  feedbackItems = data || [];
  renderFeedbackList();
}

function toggleFeedbackView() {
  const pub = document.getElementById('feedbackPublic');
  const staff = document.getElementById('feedbackStaff');
  const btn = document.getElementById('viewFeedbackBtn');
  const isShowing = staff.style.display !== 'none';
  staff.style.display = isShowing ? 'none' : 'block';
  pub.style.display = isShowing ? 'block' : 'none';
  btn.textContent = isShowing ? 'View Inbox' : 'Close Inbox';
  if (!isShowing) loadFeedback();
}

function renderFeedbackList() {
  const list = document.getElementById('feedbackList');
  if (!feedbackItems.length) {
    list.innerHTML = '<div class="notices-empty">No feedback yet.</div>';
    return;
  }
  list.innerHTML = feedbackItems.map(f => {
    const date = new Date(f.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const refNum = 'FB-' + f.id.slice(0, 4).toUpperCase();
    return `
      <div class="feedback-item">
        <div class="fb-item-name">${f.name || 'Anonymous'} <span class="fb-item-meta">· ${refNum} · ${date}</span></div>
        <div class="fb-item-msg">${f.message}</div>
        ${f.reply ? `<div class="fb-item-reply">✅ Replied: ${f.reply}</div>` : `<button class="fb-reply-btn" onclick="openFeedbackReply('${f.id}')">Reply</button>`}
      </div>
    `;
  }).join('');
}

async function submitFeedback() {
  const name = document.getElementById('fbName').value.trim();
  const message = document.getElementById('fbMessage').value.trim();
  if (!message) { toast('Please write your feedback'); return; }
  const { data, error } = await sb.from('feedback').insert({ name: name || null, message }).select().single();
  if (error) { toast('Failed to submit feedback'); return; }
  const refNum = 'FB-' + data.id.slice(0, 4).toUpperCase();
  document.getElementById('fbName').value = '';
  document.getElementById('fbMessage').value = '';
  document.getElementById('fbReplyResult').innerHTML = `
    <div class="fb-ref-badge">
      ✅ Feedback submitted! Your reference number is:<br/>
      <span class="fb-ref-num">${refNum}</span><br/>
      Keep this number to check for a reply later.
    </div>
  `;
  toast('✅ Feedback submitted');
}

async function checkFeedbackReply() {
  const ref = document.getElementById('fbRef').value.trim().toUpperCase();
  if (!ref.startsWith('FB-')) { toast('Invalid reference number'); return; }
  const id = ref.replace('FB-', '').toLowerCase();
  const { data } = await sb.from('feedback').select('*').ilike('id', id + '%').single();
  const el = document.getElementById('fbReplyResult');
  if (!data) {
    el.innerHTML = '<div class="fb-ref-badge">No feedback found with that reference number.</div>';
    return;
  }
  el.innerHTML = data.reply
    ? `<div class="fb-ref-badge">✅ Reply received:<br/><strong>${data.reply}</strong></div>`
    : `<div class="fb-ref-badge">⏳ No reply yet. Please check back later.</div>`;
}

function openFeedbackReply(id) {
  activeFeedbackId = id;
  const f = feedbackItems.find(x => x.id === id);
  if (!f) return;
  document.getElementById('fbDetail').textContent = f.message;
  document.getElementById('fbReplyText').value = '';
  document.getElementById('feedbackReplyModal').classList.remove('hidden');
}

async function submitFeedbackReply() {
  const reply = document.getElementById('fbReplyText').value.trim();
  if (!reply) { toast('Write a reply first'); return; }
  const author = currentUser?.email?.split('@')[0] || 'Staff';
  const { error } = await sb.from('feedback').update({
    reply,
    replied_at: new Date().toISOString(),
    replied_by: author
  }).eq('id', activeFeedbackId);
  if (error) { toast('Failed to send reply'); return; }
  closeModal('feedbackReplyModal');
  toast('✅ Reply sent');
  loadFeedback();
}

// ── CIRCULARS ─────────────────────────────────────────────────────────────────
async function loadCirculars() {
  const { data } = await sb.from('circulars').select('*, circular_acks(id, parent_name, acknowledged_at)').order('created_at', { ascending: false });
  circulars = data || [];
  renderCirculars();
}

function renderCirculars() {
  const list = document.getElementById('circularsList');
  if (!circulars.length) {
    list.innerHTML = '<div class="notices-empty">No circulars yet.</div>';
    return;
  }
  list.innerHTML = circulars.map(c => {
    const date = new Date(c.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const ackCount = c.circular_acks?.length || 0;
    return `
      <div class="circular-card" onclick="openCircularDetail('${c.id}')">
        <div class="circular-title">${c.title}</div>
        <div class="circular-meta">${c.author} · ${date}</div>
        <div class="circular-ack-count">✅ ${ackCount} acknowledged</div>
      </div>
    `;
  }).join('');
}

function openCircularModal() {
  document.getElementById('circularTitle').value = '';
  document.getElementById('circularBody').value = '';
  document.getElementById('circularModal').classList.remove('hidden');
}

async function saveCircular() {
  const title = document.getElementById('circularTitle').value.trim();
  const body = document.getElementById('circularBody').value.trim();
  if (!title || !body) { toast('Please fill in title and content'); return; }
  const author = currentUser?.email?.split('@')[0] || 'Staff';
  const { data, error } = await sb.from('circulars').insert({
    title, body, author, author_id: currentUser?.id
  }).select().single();
  if (error) { toast('Failed to publish circular'); return; }
  closeModal('circularModal');
  toast('✅ Circular published');
  loadCirculars();
}

function openCircularDetail(id) {
  const c = circulars.find(x => x.id === id);
  if (!c) return;
  const date = new Date(c.created_at).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  document.getElementById('cdTitle').textContent = c.title;
  document.getElementById('cdMeta').textContent = `${c.author} · ${date}`;
  document.getElementById('cdBody').textContent = c.body;

  const isStaff = currentRole === 'admin' || currentRole === 'teacher';
  const acks = c.circular_acks || [];

  // Ack section
  const ackSection = document.getElementById('cdAckSection');
  if (isStaff) {
    ackSection.innerHTML = `
      <div class="ack-form">
        <div class="ack-title">📋 Acknowledgements (${acks.length})</div>
        <div class="ack-list">
          ${acks.length ? acks.map(a => `<div class="ack-item">✅ ${a.parent_name} — ${new Date(a.acknowledged_at).toLocaleDateString('en-GB')}</div>`).join('') : '<div class="ack-item">No acknowledgements yet.</div>'}
        </div>
      </div>
    `;
  } else {
    ackSection.innerHTML = `
      <div class="ack-form">
        <div class="ack-title">Acknowledge Receipt</div>
        <input type="text" id="ackName" placeholder="Your name" class="ack-input"/>
        <button class="ack-btn" onclick="submitAck('${c.id}')">✅ I've Read This</button>
      </div>
    `;
  }

  // Actions
  const actions = document.getElementById('cdActions');
  const isAuthor = c.author_id === currentUser?.id;
  actions.innerHTML = isStaff
    ? `
      <button class="nd-action-btn gold" onclick="downloadCircularPdf('${c.id}')">📄 Download PDF</button>
      ${isAuthor ? `<button class="nd-action-btn danger" onclick="deleteCircular('${c.id}')">🗑 Delete</button>` : ''}
    `
    : `<button class="nd-action-btn gold" onclick="downloadCircularPdf('${c.id}')">📄 Download PDF</button>`;

  document.getElementById('circularDetailModal').classList.remove('hidden');
}

async function submitAck(circularId) {
  const name = document.getElementById('ackName')?.value.trim();
  if (!name) { toast('Please enter your name'); return; }
  const { error } = await sb.from('circular_acks').insert({ circular_id: circularId, parent_name: name });
  if (error) { toast('Failed to acknowledge'); return; }
  toast('✅ Thank you! Acknowledgement recorded');
  closeModal('circularDetailModal');
  loadCirculars();
}

async function deleteCircular(id) {
  if (!confirm('Delete this circular?')) return;
  await sb.from('circulars').delete().eq('id', id);
  closeModal('circularDetailModal');
  toast('Circular deleted');
  loadCirculars();
}

function downloadCircularPdf(id) {
  const c = circulars.find(x => x.id === id);
  if (!c) return;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const navy = [13, 30, 58], gold = [201, 164, 74], white = [255, 255, 255], ink = [30, 40, 60];
  const PW = 210;

  // Header
  doc.setFillColor(...navy);
  doc.rect(0, 0, PW, 38, 'F');
  doc.setFillColor(...gold);
  doc.rect(0, 36, PW, 2, 'F');
  doc.setTextColor(...gold);
  doc.setFontSize(14); doc.setFont('helvetica', 'bold');
  doc.text('Jewel Model Primary School', PW / 2, 14, { align: 'center' });
  doc.setTextColor(...white);
  doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  doc.text('Official Circular', PW / 2, 22, { align: 'center' });
  doc.setFontSize(11); doc.setFont('helvetica', 'bold');
  doc.text(c.title, PW / 2, 30, { align: 'center' });

  // Meta
  const date = new Date(c.created_at).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  doc.setTextColor(...ink);
  doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  doc.text(`Author: ${c.author}   |   Date: ${date}`, 14, 48);

  // Body
  doc.setFontSize(11); doc.setFont('helvetica', 'normal');
  const lines = doc.splitTextToSize(c.body, PW - 28);
  doc.text(lines, 14, 58);

  // Footer
  doc.setFillColor(...navy);
  doc.rect(0, 287, PW, 10, 'F');
  doc.setTextColor(...gold);
  doc.setFontSize(7);
  doc.text('Jewel Model Primary School · JMS-N', PW / 2, 293, { align: 'center' });

  doc.save(`${c.title.replace(/\s+/g, '_')}_Circular.pdf`);
  toast('📄 PDF downloaded');
}

// ── ONLINE/OFFLINE ────────────────────────────────────────────────────────────
window.addEventListener('online', showOnlineBanner);
window.addEventListener('offline', showOfflineBanner);

function showOfflineBanner() {
  let b = document.getElementById('offlineBanner');
  if (!b) { b = document.createElement('div'); b.id = 'offlineBanner'; b.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:999;padding:10px;font-size:12px;font-weight:700;text-align:center;background:#b52b2b;color:#fff;'; document.body.appendChild(b); }
  b.textContent = '📵 Offline — changes will sync when reconnected';
  b.style.display = 'block';
}

function showOnlineBanner() {
  const b = document.getElementById('offlineBanner');
  if (b) { b.style.background = '#1a6e3c'; b.textContent = '✅ Back online'; setTimeout(() => b.style.display = 'none', 2500); }
}
