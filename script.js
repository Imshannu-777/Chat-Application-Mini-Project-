// ===== STATE =====
let apiKey = '';
let provider = '';      // 'anthropic' or 'gemini'
let conversationHistory = [];
let isWaiting = false;

// ===== PROVIDER CONFIG =====
const PROVIDERS = {
  anthropic: {
    name: 'Claude (Anthropic)',
    emoji: '🤖',
    keyPrefix: 'sk-ant-',
    hint: 'Get your key at console.anthropic.com → Key starts with sk-ant-...',
    badge: 'Claude AI',
    badgeClass: '',
  },
  gemini: {
    name: 'Gemini (Google)',
    emoji: '✨',
    keyPrefix: 'A',
    hint: 'Get your key at aistudio.google.com → Key starts with AIza...',
    badge: 'Gemini AI',
    badgeClass: 'gemini',
  }
};

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('init-time').textContent = getTime();

  document.getElementById('apikey-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveKey();
  });

  document.getElementById('msg-input').addEventListener('input', () => {
    const val = document.getElementById('msg-input').value.trim();
    document.getElementById('send-btn').disabled = !val || !apiKey || isWaiting;
  });
});

// ===== PROVIDER CHANGE =====
function onProviderChange() {
  provider = document.getElementById('provider-select').value;
  const input = document.getElementById('apikey-input');
  const saveBtn = document.getElementById('save-btn');
  const hint = document.getElementById('banner-hint');

  if (provider && PROVIDERS[provider]) {
    const p = PROVIDERS[provider];
    input.disabled = false;
    input.placeholder = `Paste your ${p.name} API key...`;
    saveBtn.disabled = false;
    hint.textContent = '💡 ' + p.hint;
    input.value = '';
    input.focus();
  } else {
    input.disabled = true;
    input.placeholder = 'Paste your API key here...';
    saveBtn.disabled = true;
    hint.textContent = '';
  }
}

// ===== SAVE API KEY =====
function saveKey() {
  const val = document.getElementById('apikey-input').value.trim();
  const p = PROVIDERS[provider];

  if (!provider) { alert('Please select an AI provider first.'); return; }
  if (!val) { alert('Please enter your API key.'); return; }
  if (!val.startsWith(p.keyPrefix)) {
    alert(`Invalid key for ${p.name}.\nKey should start with: "${p.keyPrefix}"`);
    return;
  }

  apiKey = val;

  // Update UI
  document.getElementById('apikey-banner').style.display = 'none';
  document.getElementById('msg-input').disabled = false;
  document.getElementById('msg-input').focus();
  document.getElementById('app-title').textContent = p.name + ' Chat';
  document.getElementById('avatar').textContent = p.emoji;

  // Show provider badge
  const badge = document.getElementById('provider-badge');
  badge.textContent = p.badge;
  badge.className = p.badgeClass;
  badge.style.display = 'inline-block';

  // Apply theme
  if (provider === 'gemini') {
    document.body.classList.add('gemini-mode');
  } else {
    document.body.classList.remove('gemini-mode');
  }

  setStatus('Online', 'online');

  // Welcome message
  addMessageToUI('ai', `✅ Connected to ${p.name}! Ask me anything.`);
}

// ===== SEND MESSAGE =====
async function sendMessage() {
  const input = document.getElementById('msg-input');
  const text = input.value.trim();
  if (!text || isWaiting || !apiKey) return;

  input.value = '';
  input.style.height = 'auto';
  document.getElementById('send-btn').disabled = true;

  addMessageToUI('user', text);
  conversationHistory.push({ role: 'user', content: text });

  isWaiting = true;
  setStatus('Typing...', 'typing');
  showTypingIndicator();

  try {
    let reply = '';

    if (provider === 'anthropic') {
      reply = await callAnthropic(text);
    } else if (provider === 'gemini') {
      reply = await callGemini(text);
    }

    removeTypingIndicator();
    conversationHistory.push({ role: 'assistant', content: reply });
    addMessageToUI('ai', reply);
    setStatus('Online', 'online');

  } catch (err) {
    removeTypingIndicator();
    addMessageToUI('ai', '⚠️ Error: ' + err.message);
    setStatus('Error', 'error');
    console.error(err);
  }

  isWaiting = false;
  const currentText = document.getElementById('msg-input').value.trim();
  document.getElementById('send-btn').disabled = !currentText;
}

// ===== ANTHROPIC API =====
async function callAnthropic(text) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: 'You are a helpful, friendly AI assistant. Give clear and concise responses.',
      messages: conversationHistory
    })
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error?.message || 'Anthropic API error');
  }

  return data.content[0].text;
}

// ===== GEMINI API =====
async function callGemini(text) {
  // Build Gemini-format history (alternating user/model)
  const geminiHistory = conversationHistory.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: geminiHistory })
    }
  );

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error?.message || 'Gemini API error');
  }

  return data.candidates[0].content.parts[0].text;
}

// ===== UI HELPERS =====
function addMessageToUI(role, text) {
  const container = document.getElementById('messages');
  const p = provider ? PROVIDERS[provider] : null;

  const row = document.createElement('div');
  row.className = `msg-row ${role}`;

  const avatarEl = document.createElement('div');
  avatarEl.className = 'bubble-avatar';
  avatarEl.textContent = role === 'ai' ? (p ? p.emoji : '🤖') : '🧑';

  const wrap = document.createElement('div');
  wrap.className = 'bubble-wrap';

  const bubble = document.createElement('div');
  bubble.className = `bubble ${role}`;
  bubble.textContent = text;

  const timeEl = document.createElement('div');
  timeEl.className = 'bubble-time';
  timeEl.textContent = getTime();

  wrap.appendChild(bubble);
  wrap.appendChild(timeEl);
  row.appendChild(avatarEl);
  row.appendChild(wrap);
  container.appendChild(row);
  container.scrollTop = container.scrollHeight;
}

function showTypingIndicator() {
  const container = document.getElementById('messages');
  const row = document.createElement('div');
  row.className = 'msg-row ai';
  row.id = 'typing-row';

  const avatarEl = document.createElement('div');
  avatarEl.className = 'bubble-avatar';
  avatarEl.textContent = provider ? PROVIDERS[provider].emoji : '🤖';

  const indicator = document.createElement('div');
  indicator.className = 'typing-indicator';
  indicator.innerHTML = '<span></span><span></span><span></span>';

  row.appendChild(avatarEl);
  row.appendChild(indicator);
  container.appendChild(row);
  container.scrollTop = container.scrollHeight;
}

function removeTypingIndicator() {
  const el = document.getElementById('typing-row');
  if (el) el.remove();
}

function clearChat() {
  if (!confirm('Clear all messages?')) return;
  conversationHistory = [];
  document.getElementById('messages').innerHTML = '';
  addMessageToUI('ai', '🧹 Chat cleared! Start a new conversation.');
  setStatus('Online', 'online');
}

function setStatus(text, state) {
  document.getElementById('status-text').textContent = text;
  const dot = document.getElementById('status-dot');
  dot.className = state;
}

function getTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 110) + 'px';
}

function handleKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}
