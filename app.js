const tg = (window.Telegram && window.Telegram.WebApp) ? window.Telegram.WebApp : null;
if (tg) tg.expand();

const ADSGRAM_BLOCK_ID = "60949";
const BOT_USERNAME = "westyloot_bot";
const ADMIN_CHAT_ID = "5888218785";
const API_BASE = 'https://' + 'westyloot.l8153766' + '.workers.dev/api';

let state = {
  coins: 0, keys: 0, stars: 0, adsWeek: 0, adsMonth: 0, casesOpened: 0,
  dailyUsed: false, refClaimed: false, acAdProgress: 0, acEndTime: 0,
  tradeUrl: '', usedPromos: [], inventory: []
};
let currentCase = 'coin_15k', isSpinning = false, lastWonSkin = null, adCtrl = null, acSaveTick = 0;

function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.innerText = msg; t.style.display = 'block';
  clearTimeout(t._tm); t._tm = setTimeout(() => { t.style.display = 'none'; }, 2500);
}

function updateUI() {
  document.getElementById('balCoins').innerText = Math.floor(state.coins).toLocaleString();
  document.getElementById('balKeys').innerText = Math.floor(state.keys).toLocaleString();
  document.getElementById('balStars').innerText = Math.floor(state.stars).toLocaleString();
  const acBtn = document.getElementById('acWatchBtn');
  if (acBtn) acBtn.innerText = `🎬 Автокликер (2 кл/с на 1ч): ${state.acAdProgress} / 5 реклам`;
  renderInventory();
}

function switchTab(name, btn) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  if (btn) btn.classList.add('active');
}
function mkCase(title, cur, cost, mult, skins) {
  const c = [0.25, 0.6, 1.1, 1.6].map(m => Math.round(cost * m));
  const w =;
  const items = c.map((v, i) => ({
    label: v.toLocaleString() + (cur === 'coins' ? ' 🪙' : ' 🔑'),
    val: v, valCur: cur, chance: w[i], tier: i >= 2 ? 'gold' : ''
  }));
  skins.forEach(([name, price, sk, ss, ch]) => items.push({
    label: `${name} ($${price})`, chance: ch, tier: price >= 1.5 ? 'red' : 'gold',
    skin: { name, price, sellKeys: sk, sellStars: ss }
  }));
  return { title, currency: cur, cost, costText: cost.toLocaleString() + (cur === 'coins' ? ' 🪙' : cur === 'keys' ? ' 🔑' : ' ⭐'), items };
}

const CASES_CONFIG = {
  guarant_300k: {
    title: '👑 Гарант-кейс ($1.50–$25)', currency: 'guarant', costCoins: 300000, costKeys: 65, costText: '300 000 🪙 + 65 🔑',
    items: [
      ['AK-47 | Slate', 1.50, 35, 60, 34], ['M4A4 | Magnesium', 1.80, 42, 72, 26],
      ['Glock-18 | Vogue', 2.50, 55, 100, 16], ['USP-S | Cortex', 3.50, 80, 140, 10],
      ['M4A1-S | Decimator', 5.00, 110, 200, 6], ['AWP | Neo-Noir', 7.50, 165, 300, 4],
      ['AK-47 | Ice Coaled', 11.00, 240, 440, 2.2], ['Deagle | Printstream', 16.00, 350, 640, 1.3],
      ['AWP | Asiimov', 25.00, 550, 1000, 0.5]
    ].map(([name, price, sk, ss, ch]) => ({ label: `${name} ($${price})`, chance: ch, tier: price >= 5 ? 'red' : 'gold', skin: { name, price, sellKeys: sk, sellStars: ss } }))
  },
  coin_15k: mkCase('🥉 Кейс «Медный»', 'coins', 15000, 1, [
    ['MP9 | Sand Dashed', 0.10, 3, 5, 11], ['P250 | Sand Dune', 0.18, 5, 8, 7],
    ['MAC-10 | Silver', 0.30, 8, 13, 4.5], ['Glock-18 | Oxide', 0.50, 12, 22, 2.5],
    ['USP-S | Ticket to Hell', 0.90, 22, 38, 1]
  ]),
  coin_50k: mkCase('🥈 Кейс «Серебряный»', 'coins', 50000, 1, [
    ['P250 | Sand Dune', 0.25, 6, 11, 11], ['Glock-18 | Oxide', 0.45, 11, 20, 7],
    ['USP-S | Ticket to Hell', 0.85, 21, 36, 4.5], ['AK-47 | Safari Mesh', 1.30, 32, 55, 2.5],
    ['M4A4 | Magnesium', 1.80, 45, 75, 1]
  ]),
  coin_100k: mkCase('🥇 Кейс «Золотой»', 'coins', 100000, 1, [
    ['Glock-18 | Oxide', 0.50, 12, 22, 11], ['USP-S | Ticket to Hell', 0.90, 22, 38, 7],
    ['AK-47 | Slate', 1.50, 36, 62, 4.5], ['AWP | Atheris', 2.20, 52, 90, 2.5],
    ['USP-S | Cortex', 3.50, 82, 140, 1]
  ]),
  coin_150k: mkCase('💠 Кейс «Платиновый»', 'coins', 150000, 1, [
    ['USP-S | Ticket to Hell', 0.85, 21, 36, 11], ['AK-47 | Safari Mesh', 1.30, 32, 55, 7],
    ['M4A4 | Magnesium', 1.90, 46, 78, 4.5], ['Glock-18 | Vogue', 2.80, 66, 112, 2.5],
    ['M4A1-S | Decimator', 4.50, 105, 180, 1]
  ]),
  coin_200k: mkCase('💎 Кейс «Алмазный»', 'coins', 200000, 1, [
    ['AK-47 | Safari Mesh', 1.20, 28, 48, 11], ['M4A4 | Magnesium', 1.80, 45, 75, 7],
    ['AWP | Atheris', 2.50, 60, 100, 4.5], ['AK-47 | Ice Coaled', 4.20, 98, 168, 2.5],
    ['AWP | Neo-Noir', 7.00, 160, 280, 1]
  ]),
  coin_350k: mkCase('🔮 Кейс «Мифический»', 'coins', 350000, 1, [
    ['AWP | Atheris', 2.00, 48, 82, 11], ['Glock-18 | Vogue', 3.00, 72, 120, 7],
    ['M4A1-S | Decimator', 4.80, 112, 192, 4.5], ['AWP | Neo-Noir', 7.50, 170, 300, 2.5],
    ['M4A1-S | Hyper Beast', 12.00, 270, 480, 1]
  ]),
  coin_500k: mkCase('👑 Кейс «Императорский»', 'coins', 500000, 1, [
    ['M4A4 | Magnesium', 3.50, 82, 140, 11], ['M4A1-S | Decimator', 5.00, 115, 200, 7],
    ['AWP | Neo-Noir', 8.00, 180, 320, 4.5], ['Deagle | Printstream', 15.00, 330, 600, 2.5],
    ['AWP | Asiimov', 25.00, 550, 1000, 1]
  ]),
  free_25: mkCase('📦 Кейс «Новичок»', 'keys', 25, 1, [
    ['P250 | Sand Dune', 0.25, 6, 11, 11], ['MP9 | Sand Dashed', 0.40, 10, 17, 7],
    ['Glock-18 | Oxide', 0.65, 16, 27, 4.5], ['USP-S | Ticket to Hell', 1.10, 26, 45, 2.5],
    ['AK-47 | Slate', 1.60, 38, 65, 1]
  ]),
  free_50: mkCase('🎒 Кейс «Базовый»', 'keys', 50, 1, [
    ['Glock-18 | Oxide', 0.50, 12, 22, 11], ['USP-S | Ticket to Hell', 0.90, 22, 38, 7],
    ['AK-47 | Slate', 1.50, 36, 62, 4.5], ['M4A4 | Magnesium', 2.10, 50, 85, 2.5],
    ['AWP | Atheris', 3.00, 72, 120, 1]
  ]),
  free_75: mkCase('🎖️ Кейс «Армейский»', 'keys', 75, 1, [
    ['USP-S | Ticket to Hell', 1.00, 24, 40, 11], ['AK-47 | Slate', 1.60, 38, 65, 7],
    ['Glock-18 | Vogue', 2.60, 62, 105, 4.5], ['USP-S | Cortex', 3.80, 90, 152, 2.5],
    ['M4A1-S | Decimator', 5.00, 115, 200, 1]
  ]),
  free_100: mkCase('🔫 Кейс «Запрещённый»', 'keys', 100, 1, [
    ['AK-47 | Slate', 2.50, 55, 100, 11], ['Glock-18 | Vogue', 3.40, 78, 136, 4.5],
    ['M4A1-S | Decimator', 5.00, 115, 200, 7], ['AWP | Neo-Noir', 7.50, 170, 300, 2.5],
    ['M4A1-S | Hyper Beast', 11.00, 250, 440, 1]
  ]),
  free_150: mkCase('🔮 Кейс «Засекреченный»', 'keys', 150, 1, [
    ['M4A1-S | Decimator', 4.00, 90, 160, 11], ['AWP | Neo-Noir', 6.50, 150, 260, 7],
    ['AK-47 | Ice Coaled', 9.50, 215, 380, 4.5], ['Deagle | Printstream', 14.00, 315, 560, 2.5],
    ['AWP | Asiimov', 22.00, 490, 880, 1]
  ]),
  free_200: mkCase('🔥 Кейс «Тайный»', 'keys', 200, 1, [
    ['AWP | Neo-Noir', 6.00, 130, 240, 11], ['AK-47 | Ice Coaled', 9.00, 200, 360, 7],
    ['M4A1-S | Hyper Beast', 13.00, 290, 520, 4.5], ['Deagle | Printstream', 18.00, 400, 720, 2.5],
    ['AWP | Asiimov', 28.00, 620, 1120, 1]
  ]),
  free_300: mkCase('👑 Кейс «Легендарный»', 'keys', 300, 1, [
    ['Deagle | Printstream', 15.00, 320, 600, 11], ['AWP | Asiimov', 25.00, 550, 1000, 7],
    ['★ Нож-наваха | Сажа', 45.00, 980, 1800, 4.5], ['★ Штык-нож | Автотроника', 70.00, 1500, 2800, 2.5],
    ['★ Нож-бабочка | Градиент', 100.00, 2200, 4000, 1]
  ]),
  donate_start: mkCase('💠 Кейс «Стартовый»', 'stars', 50, 1, [
    ['P250 | Sand Dune', 0.25, 6, 11, 25], ['Glock-18 | Oxide', 0.50, 12, 22, 18],
    ['AK-47 | Slate', 1.50, 36, 62, 12], ['M4A4 | Magnesium', 2.20, 52, 90, 6],
    ['USP-S | Cortex', 5.00, 115, 200, 2]
  ]),
  donate_elite: mkCase('⚡ Кейс «Элитный»', 'stars', 150, 1, [
    ['AWP | Atheris', 1.00, 24, 40, 25], ['AK-47 | Ice Coaled', 2.50, 55, 100, 18],
    ['M4A1-S | Decimator', 5.00, 115, 200, 12], ['AWP | Neo-Noir', 9.00, 200, 360, 6],
    ['Deagle | Printstream', 15.00, 330, 600, 2]
  ]),
  donate_knife: mkCase('🗡️ Кейс «Ножевой»', 'stars', 500, 1, [
    ['AK-47 | Redline', 3.00, 70, 120, 25], ['AWP | Neo-Noir', 8.00, 180, 320, 18],
    ['M4A1-S | Hyper Beast', 15.00, 330, 600, 12], ['AWP | Asiimov', 35.00, 750, 1400, 6],
    ['★ Нож-бабочка ($100)', 100.00, 2200, 4000, 2]
  ])
};
function selectCase(id, silent = false) {
  if (isSpinning || !CASES_CONFIG[id]) return;
  currentCase = id;
  const cfg = CASES_CONFIG[id];
  document.getElementById('selectedCaseTitle').innerText = cfg.title;
  document.getElementById('selectedCaseCost').innerText = cfg.costText;
  const tot = cfg.items.reduce((a, b) => a + b.chance, 0);
  document.getElementById('caseDropsList').innerHTML = cfg.items.map(it => `<span class="live-chip ${it.tier === 'red' ? 'rare' : ''}">${it.label} (${((it.chance/tot)*100).toFixed(1)}%)</span>`).join('');
  buildTrack(cfg.items[0].label);
  if (!silent) showToast('Выбран: ' + cfg.title);
}

function buildTrack(winLabel) {
  const cfg = CASES_CONFIG[currentCase], tr = document.getElementById('track');
  tr.style.transition = 'none'; tr.style.transform = 'translateX(0px)';
  let html = '';
  for (let i = 0; i < 35; i++) {
    const it = (i === 28) ? (cfg.items.find(x => x.label === winLabel) || cfg.items[0]) : cfg.items[Math.floor(Math.random() * cfg.items.length)];
    html += `<div class="r-item ${it.tier}">${it.label}</div>`;
  }
  tr.innerHTML = html;
}

function spinSelectedCase(fast = false) {
  if (isSpinning) return;
  const cfg = CASES_CONFIG[currentCase];
  if (cfg.currency === 'guarant') {
    if (state.coins < 300000 || state.keys < 65) return showToast('Нужно 300 000 🪙 и 65 🔑!');
    state.coins -= 300000; state.keys -= 65;
  } else if (state[cfg.currency] < cfg.cost) return showToast('Недостаточно средств!');
  else state[cfg.currency] -= cfg.cost;
  isSpinning = true; state.casesOpened += 1; updateUI();
  const tot = cfg.items.reduce((a, b) => a + b.chance, 0), skins = cfg.items.filter(x => x.skin);
  let r = Math.random() * tot, acc = 0, chosen = cfg.items[0];
  for (const it of cfg.items) { acc += it.chance; if (r <= acc) { chosen = it; break; } }
  if (state.casesOpened === 2 && skins.length) chosen = skins[0];
  buildTrack(chosen.label);
  const tr = document.getElementById('track'), off = (28 * 94) + 47 - (tr.parentElement.offsetWidth / 2), dur = fast ? 350 : 3500;
  setTimeout(() => { tr.style.transition = `transform ${dur}ms cubic-bezier(0.15,0.85,0.25,1)`; tr.style.transform = `translateX(-${off}px)`; }, 30);
  setTimeout(() => {
    isSpinning = false;
    if (chosen.skin) { lastWonSkin = chosen.skin; openWinModal(chosen.skin); }
    else { state[chosen.valCur] += chosen.val; showToast('Выпало: ' + chosen.label); updateUI(); saveProgress(); }
  }, dur + 120);
}

function openWinModal(s) {
  document.getElementById('modalIcon').innerText = s.name.includes('Нож') ? '🗡' : '🔫';
  document.getElementById('modalTitle').innerText = s.name;
  document.getElementById('modalPrice').innerText = `$${s.price.toFixed(2)} (или ${s.sellStars} ⭐)`;
  document.getElementById('modalSellBtn').innerHTML = `💰 +${s.sellKeys} 🔑 &nbsp;|&nbsp; <span onclick="event.stopPropagation();sellWonStars()">⭐ +${s.sellStars} Stars</span>`;
  document.getElementById('winModal').style.display = 'flex';
}
function closeWinModal(keep) {
  document.getElementById('winModal').style.display = 'none';
  if (!lastWonSkin) return;
  if (keep) { state.inventory.push(lastWonSkin); showToast('Скин добавлен в инвентарь!'); }
  else { state.keys += lastWonSkin.sellKeys; showToast(`Продано за +${lastWonSkin.sellKeys} 🔑!`); }
  lastWonSkin = null; updateUI(); saveProgress();
}

function sellWonStars() {
  if (!lastWonSkin) return;
  state.stars += lastWonSkin.sellStars; showToast(`Продано за +${lastWonSkin.sellStars} ⭐!`);
  lastWonSkin = null; document.getElementById('winModal').style.display = 'none'; updateUI(); saveProgress();
}

function renderInventory() {
  const box = document.getElementById('invList');
  if (!box) return;
  const wdBtn = `<button class="btn btn-green" style="margin-bottom:10px;" onclick="withdrawStars()">⭐ Вывести Stars в Telegram (${Math.floor(state.stars)} ⭐)</button>`;
  if (!state.inventory.length) { box.innerHTML = wdBtn + '<div class="card" style="text-align:center;color:var(--muted);">Инвентарь пуст</div>'; return; }
  box.innerHTML = wdBtn + state.inventory.map((s, i) => `
    <div class="card" style="display:flex;justify-content:space-between;align-items:center;padding:10px;">
      <div><b>${s.name}</b><div style="font-size:11px;color:var(--accent);">$${s.price.toFixed(2)}</div></div>
      <div style="display:flex;gap:4px;">
        <button class="btn btn-blue btn-sm" style="margin:0;" onclick="sellInv(${i},'k')">+${s.sellKeys} 🔑</button>
        <button class="btn btn-green btn-sm" style="margin:0;" onclick="sellInv(${i},'s')">+${s.sellStars} ⭐</button>
      </div>
    </div>`).join('');
}

function sellInv(idx, type) {
  const s = state.inventory.splice(idx, 1);
  if (!s) return;
  if (type === 's') { state.stars += s.sellStars; showToast(`+${s.sellStars} ⭐`); }
  else { state.keys += s.sellKeys; showToast(`+${s.sellKeys} 🔑`); }
  updateUI(); saveProgress();
}

async function withdrawStars() {
  const amt = Math.floor(Number(prompt('Сколько Stars вывести? (минимум 50 ⭐)', Math.floor(state.stars)) || 0));
  if (amt < 50 || state.stars < amt) return showToast('Минимум 50 ⭐ или не хватает баланса!');
  const res = await fetch(`${API_BASE}/withdraw_stars`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData: tg ? tg.initData : '', amount: amt, adminId: ADMIN_CHAT_ID })
  });
  const d = await res.json();
  if (!res.ok) return showToast(d.error || 'Ошибка вывода');
  state.stars = d.stars; showToast(`✅ Заявка на ${amt} ⭐ отправлена!`); updateUI();
}
function runAd(cb) {
  const show = () => { if (!adCtrl) adCtrl = window.Adsgram.init({ blockId: ADSGRAM_BLOCK_ID }); adCtrl.show().then(cb).catch(() => showToast('Реклама не досмотрена')); };
  if (window.Adsgram) return show();
  const s = document.createElement('script'); s.src = 'https://' + 'sad.adsgram.ai' + '/js/sad.min.js';
  s.onload = show; s.onerror = () => showToast('AdsGram недоступен'); document.head.appendChild(s);
}
function watchAdForKey() { runAd(() => { state.keys += 1; state.adsWeek += 1; state.adsMonth += 1; showToast('+1 🔑 за рекламу!'); updateUI(); saveProgress(); }); }
function watchAdForAutoclicker() {
  runAd(() => {
    state.adsWeek += 1; state.adsMonth += 1; state.acAdProgress += 1;
    if (state.acAdProgress >= 5) { state.acAdProgress = 0; state.acEndTime = Date.now() + 3600000; showToast('⚡ Автокликер запущен на 1 час!'); }
    else showToast(`Прогресс автокликера: ${state.acAdProgress}/5`);
    updateUI(); saveProgress();
  });
}
function spinDailyWheel() {
  if (state.dailyUsed) return showToast('Уже крутил сегодня!');
  state.dailyUsed = true; const win = [5000, 15000, 3, 10][Math.floor(Math.random() * 4)];
  if (win >= 1000) { state.coins += win; showToast(`🎡 Выпало +${win.toLocaleString()} 🪙!`); }
  else { state.keys += win; showToast(`🎡 Выпало +${win} 🔑!`); }
  updateUI(); saveProgress();
}
function copyRefLink() { const inp = document.getElementById('refLinkInput'); inp.select(); navigator.clipboard.writeText(inp.value); showToast('Ссылка скопирована!'); }
function saveTradeUrl() { state.tradeUrl = document.getElementById('tradeUrlInput').value.trim(); showToast('Trade URL сохранён!'); saveProgress(); }
function usePromo() {
  const code = document.getElementById('promoInput').value.trim().toUpperCase();
  if (!code || state.usedPromos.includes(code)) return showToast('Неверный или использованный промокод');
  if (code === 'START2026') { state.usedPromos.push(code); state.keys += 10; showToast('🎁 +10 🔑 по промокоду!'); updateUI(); saveProgress(); }
  else showToast('Промокод не найден');
}
async function saveProgress() {
  if (!tg || !tg.initData) return;
  fetch(`${API_BASE}/secure_save`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ initData: tg.initData, state }) }).catch(() => {});
}
async function initApp() {
  const uid = (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) ? tg.initDataUnsafe.user.id : '777';
  const refInp = document.getElementById('refLinkInput'); if (refInp) refInp.value = `https://t.me{BOT_USERNAME}?start=ref_${uid}`;
  if (tg && tg.initData) {
    try { const r = await fetch(`${API_BASE}/secure_load`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ initData: tg.initData }) }); if (r.ok) Object.assign(state, await r.json()); } catch {}
  }
  const trInp = document.getElementById('tradeUrlInput'); if (trInp && state.tradeUrl) trInp.value = state.tradeUrl;
  selectCase('coin_15k', true); updateUI();
  setInterval(() => {
    const left = state.acEndTime - Date.now(), stEl = document.getElementById('acStatusText');
    if (left > 0) { state.coins += 2; if (stEl) stEl.innerText = `⚡ Активен: ещё ${Math.ceil(left / 60000)} мин.`; updateUI(); if (++acSaveTick >= 30) { acSaveTick = 0; saveProgress(); } }
    else if (stEl) stEl.innerText = 'Не активен — посмотри 5 реклам для запуска на 1 час';
  }, 1000);
}
initApp();
