const tg = (window.Telegram && window.Telegram.WebApp) ? window.Telegram.WebApp : null;
if (tg) tg.expand();

let state = {
    coins: 0, keys: 0, stars: 0,
    adsWeek: 0, adsMonth: 0, casesOpened: 0,
    bpPremium: false, dailyUsed: false,
    referrals: 0, inventory: [], claimedBp: []
};

const savedData = localStorage.getItem('westyloot_save');
if (savedData) {
    try { state = { ...state, ...JSON.parse(savedData) }; } catch (e) {}
}

let currentCase = 'standard';
let isSpinning = false;
let wheelDeg = 0;

const CASES_CONFIG = {
    standard: { title: '📦 Обычный кейс CS2', costText: '50 🔑', currency: 'keys', cost: 50, pool: ['12 🔑', '38 🔑', '63 🔑', '100 🔑', 'AK-47 | Slate ($3)'] },
    donate_start: { title: '💠 Кейс «Стартовый»', costText: '50 ⭐', currency: 'stars', cost: 50, pool: ['P250 | Sand Dune ($0.20)', 'Glock-18 | Oxide ($0.45)', 'M4A4 | Magnesium ($1.50)', 'USP-S | Cortex ($5.00)'] },
    donate_elite: { title: '🔥 Кейс «Элитный»', costText: '150 ⭐', currency: 'stars', cost: 150, pool: ['AWP | Atheris ($0.65)', 'AK-47 | Ice Coaled ($1.70)', 'M4A1-S | Decimator ($4.00)', 'Desert Eagle | Printstream ($15.00)'] },
    donate_knife: { title: '🗡️ Кейс «Тайный / Нож»', costText: '500 ⭐', currency: 'stars', cost: 500, pool: ['AK-47 | Redline ($1.80)', 'AWP | Neo-Noir ($5.00)', 'M4A1-S | Hyper Beast ($12.00)', 'AWP | Asiimov ($35.00)', '★ Нож-бабочка ($100.00)'] }
};

function showToast(msg) {
    const t = document.getElementById('toast');
    t.innerText = msg;
    t.style.display = 'block';
    setTimeout(() => { t.style.display = 'none'; }, 2600);
}

function pushLiveDrop(user, item, rarity = 'pink') {
    const feed = document.getElementById('liveFeed');
    if (!feed) return;
    if (feed.dataset.empty === '1') {
        feed.innerHTML = '';
        feed.dataset.empty = '0';
    }
    const chip = document.createElement('div');
    const rClass = rarity === true ? 'rare' : (rarity || '');
    chip.className = 'live-chip ' + rClass;
    const icon = item.includes('Нож') ? '🗡️' : (item.includes('AWP') ? '🎯' : '🔫');
    chip.innerHTML = `<div class="live-skin">${icon} ${item}</div><div class="live-user">${user}</div>`;
    feed.prepend(chip);
    if (feed.children.length > 5) feed.lastChild.remove();
}

function initLiveFeed() {
    const feed = document.getElementById('liveFeed');
    if (!feed) return;
    feed.dataset.empty = '1';
    feed.innerHTML = '<span style="font-size:11px;color:var(--muted);">🔴 Прямой эфир: здесь появятся реальные скины игроков</span>';
}

function copyRefLink() {
    const input = document.getElementById('refLinkInput');
    input.select();
    navigator.clipboard.writeText(input.value);
    showToast('Реферальная ссылка скопирована!');
}

function switchTab(tabId, btn) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
    document.getElementById('tab-' + tabId).classList.add('active');
    btn.classList.add('active');
    if (tabId === 'shop') buildTrack(CASES_CONFIG[currentCase].pool);
    if (tabId === 'bp') renderBattlePass();
}

function getCurrentBpLevel() {
    const lvlByCases = Math.floor((state.casesOpened / 200) * 100);
    const lvlByAds = Math.floor((state.adsMonth / 50) * 100);
    return Math.min(100, Math.max(1, Math.min(lvlByCases, lvlByAds) + 1));
}

function updateUI() {
    document.getElementById('coins').innerText = state.coins.toLocaleString();
    document.getElementById('keys').innerText = state.keys;
    document.getElementById('stars').innerText = state.stars + ' ⭐';
    document.getElementById('refCount').innerText = state.referrals + ' друзей';
    document.getElementById('adsWeek').innerText = state.adsWeek;
    document.getElementById('adsMonth').innerText = state.adsMonth;
    document.getElementById('barWeek').style.width = Math.min(100, (state.adsWeek / 50) * 100) + '%';
    document.getElementById('barMonth').style.width = Math.min(100, (state.adsMonth / 250) * 100) + '%';

    document.getElementById('bpLvl').innerText = getCurrentBpLevel();
    document.getElementById('bpCases').innerText = state.casesOpened;
    document.getElementById('bpAds').innerText = Math.min(50, state.adsMonth);
    document.getElementById('barBpCases').style.width = Math.min(100, (state.casesOpened / 200) * 100) + '%';

    renderBattlePass();
    renderInventory();
}

function tapCoin() {
    state.coins += 1;
    if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
    updateUI();
}

function exchangeKey() {
    if (state.coins < 8500) return showToast('Нужно 8 500 монет!');
    state.coins -= 8500;
    state.keys += 1;
    showToast('Обменяли 8 500 монет на 1 ключ!');
    updateUI();
}

function watchAd() {
    const won = Math.random() < 0.35 ? 2 : 1;
    state.keys += won;
    state.adsWeek += 1;
    state.adsMonth += 1;
    showToast('Реклама просмотрена! +' + won + ' 🔑');
    updateUI();
}
function selectCase(caseKey) {
    if (isSpinning) return;
    currentCase = caseKey;
    const cfg = CASES_CONFIG[caseKey];
    document.getElementById('activeCaseTitle').innerText = cfg.title;
    document.getElementById('activeCasePrice').innerText = cfg.costText;
    buildTrack(cfg.pool);
    showToast('Выбран: ' + cfg.title);
}

function buildTrack(winText) {
    const track = document.getElementById('track');
    track.style.transition = 'none';
    track.style.transform = 'translateX(0px)';
    track.innerHTML = '';

    const pool = CASES_CONFIG[currentCase].pool;
    for (let i = 0; i < 35; i++) {
        const div = document.createElement('div');
        let label = (i === 28) ? winText : pool[Math.floor(Math.random() * pool.length)];
        let isRare = label.includes('$5') || label.includes('$15') || label.includes('$35') || label.includes('$100');
        let isSkin = label.includes('$');
        div.className = 'r-item' + (isRare ? ' red' : (isSkin ? ' gold' : ''));
        div.innerText = label;
        track.appendChild(div);
    }
}

function spinSelectedCase() {
    if (isSpinning) return;
    const cfg = CASES_CONFIG[currentCase];

    if (cfg.currency === 'keys') {
        if (state.keys < cfg.cost) return showToast('Нужно ' + cfg.cost + ' ключей!');
        state.keys -= cfg.cost;
    } else {
        if (state.stars < cfg.cost) return showToast('Недостаточно Stars!');
        state.stars -= cfg.cost;
    }

    isSpinning = true;
    state.casesOpened += 1;
    updateUI();

    const roll = Math.random() * 100;
    let winText = '';
    let winKeys = 0;
    let skinObj = null;

    if (currentCase === 'standard') {
        if (roll < 50) { winKeys = 12; winText = '12 🔑'; }
        else if (roll < 85) { winKeys = 38; winText = '38 🔑'; }
        else if (roll < 95) { winKeys = 63; winText = '63 🔑'; }
        else if (roll < 99.5) { winKeys = 100; winText = '100 🔑'; }
        else { winText = 'AK-47 | Slate ($3)'; skinObj = { name: 'AK-47 | Slate', price: 3.0, sellKeys: 60 }; }
    } else if (currentCase === 'donate_start') {
        if (roll < 70) { winText = 'P250 | Sand Dune ($0.20)'; skinObj = { name: 'P250 | Sand Dune', price: 0.20, sellKeys: 5 }; }
        else if (roll < 95) { winText = 'Glock-18 | Oxide ($0.45)'; skinObj = { name: 'Glock-18 | Oxide', price: 0.45, sellKeys: 12 }; }
        else if (roll < 99.5) { winText = 'M4A4 | Magnesium ($1.50)'; skinObj = { name: 'M4A4 | Magnesium', price: 1.50, sellKeys: 35 }; }
        else { winText = 'USP-S | Cortex ($5.00)'; skinObj = { name: 'USP-S | Cortex', price: 5.00, sellKeys: 110 }; }
    } else if (currentCase === 'donate_elite') {
        if (roll < 65) { winText = 'AWP | Atheris ($0.65)'; skinObj = { name: 'AWP | Atheris', price: 0.65, sellKeys: 16 }; }
        else if (roll < 93) { winText = 'AK-47 | Ice Coaled ($1.70)'; skinObj = { name: 'AK-47 | Ice Coaled', price: 1.70, sellKeys: 40 }; }
        else if (roll < 99) { winText = 'M4A1-S | Decimator ($4.00)'; skinObj = { name: 'M4A1-S | Decimator', price: 4.00, sellKeys: 90 }; }
        else { winText = 'Desert Eagle | Printstream ($15.00)'; skinObj = { name: 'Desert Eagle | Printstream', price: 15.00, sellKeys: 320 }; }
    } else if (currentCase === 'donate_knife') {
        if (roll < 70) { winText = 'AK-47 | Redline ($1.80)'; skinObj = { name: 'AK-47 | Redline', price: 1.80, sellKeys: 42 }; }
        else if (roll < 92) { winText = 'AWP | Neo-Noir ($5.00)'; skinObj = { name: 'AWP | Neo-Noir', price: 5.00, sellKeys: 110 }; }
        else if (roll < 99) { winText = 'M4A1-S | Hyper Beast ($12.00)'; skinObj = { name: 'M4A1-S | Hyper Beast', price: 12.00, sellKeys: 260 }; }
        else if (roll < 99.9) { winText = 'AWP | Asiimov ($35.00)'; skinObj = { name: 'AWP | Asiimov', price: 35.00, sellKeys: 750 }; }
        else { winText = '★ Нож-бабочка ($100.00)'; skinObj = { name: '★ Нож-бабочка', price: 100.00, sellKeys: 2000 }; }
    }

    buildTrack(winText);
    const track = document.getElementById('track');
    const wrapWidth = track.parentElement.offsetWidth;
    const itemWidth = 94;
    const targetOffset = (28 * itemWidth) + (itemWidth / 2) - (wrapWidth / 2);

    setTimeout(() => {
        track.style.transition = 'transform 3.5s cubic-bezier(0.15, 0.85, 0.25, 1)';
        track.style.transform = `translateX(-${targetOffset}px)`;
    }, 50);

    setTimeout(() => {
        isSpinning = false;
        if (skinObj) {
            state.inventory.push(skinObj);
            const rType = skinObj.price >= 50 ? 'gold' : (skinObj.price >= 5 ? 'rare' : 'pink');
            pushLiveDrop('@Вы', skinObj.name, rType);
            showToast('Выпал скин: ' + skinObj.name + '!');
        } else {
            state.keys += winKeys;
            showToast('Выпало: ' + winKeys + ' 🔑');
        }
        updateUI();
    }, 3600);
}

function buyKeysPack(keysAdd, starsCost) {
    if (state.stars < starsCost) return showToast('Не хватает Stars!');
    state.stars -= starsCost;
    state.keys += keysAdd;
    showToast('Куплено ' + keysAdd + ' ключей за ' + starsCost + ' ⭐!');
    updateUI();
}
function spinDailyWheel() {
    if (state.dailyUsed) return showToast('Ты уже крутил колесо сегодня! Приходи через 24ч');
    state.dailyUsed = true;
    state.adsWeek += 1;
    state.adsMonth += 1;

    const btn = document.getElementById('dailyBtn');
    btn.style.background = '#262b40';

    const isJackpot = Math.random() < 0.0001;
    let targetSectorDeg = 30;
    let bonusKeys = 5;

    if (isJackpot) {
        targetSectorDeg = 330;
    } else {
        const variants = [
            { keys: 5, deg: 30 },
            { keys: 10, deg: 90 },
            { keys: 15, deg: 270 },
            { keys: 25, deg: 210 }
        ];
        const pick = variants[Math.floor(Math.random() * variants.length)];
        bonusKeys = pick.keys;
        targetSectorDeg = pick.deg;
    }

    wheelDeg += 1800 + (360 - targetSectorDeg);
    document.getElementById('wheelDisc').style.transform = `rotate(${wheelDeg}deg)`;

    setTimeout(() => {
        if (isJackpot) {
            state.inventory.push({ name: 'M4A1-S | Player Two ($5)', price: 5.0, sellKeys: 110 });
            pushLiveDrop('@Вы', 'M4A1-S | Player Two', 'rare');
            showToast('🔥 ДЖЕКПОТ 0.01%! Выпал скин за $5!');
        } else {
            state.keys += bonusKeys;
            showToast('🎡 Колесо остановилось: +' + bonusKeys + ' 🔑!');
        }
        updateUI();
    }, 4100);

    let secondsLeft = 86400;
    const timer = setInterval(() => {
        secondsLeft -= 1;
        if (secondsLeft <= 0) {
            clearInterval(timer);
            state.dailyUsed = false;
            btn.innerText = '🎬 Крутить за 1 рекламу';
            btn.style.background = 'var(--green)';
            return;
        }
        const h = String(Math.floor(secondsLeft / 3600)).padStart(2, '0');
        const m = String(Math.floor((secondsLeft % 3600) / 60)).padStart(2, '0');
        const s = String(secondsLeft % 60).padStart(2, '0');
        btn.innerText = `⏳ Доступно через ${h}:${m}:${s}`;
    }, 1000);
}

function renderBattlePass() {
    const track = document.getElementById('bpTrack');
    if (!track) return;
    const curLvl = getCurrentBpLevel();
    track.innerHTML = '';

    if (!track.dataset.dragInit) {
        track.dataset.dragInit = '1';
        let isDown = false, startX, scrollLeft;
        track.addEventListener('mousedown', (e) => { isDown = true; startX = e.pageX - track.offsetLeft; scrollLeft = track.scrollLeft; });
        track.addEventListener('mouseleave', () => { isDown = false; });
        track.addEventListener('mouseup', () => { isDown = false; });
        track.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - track.offsetLeft;
            track.scrollLeft = scrollLeft - (x - startX) * 1.5;
        });
    }

    for (let lvl = 1; lvl <= 100; lvl++) {
        let freeIcon = '🪙', freeName = `${(lvl * 100).toLocaleString()} Монет`, freeType = 'coins', freeVal = lvl * 100;
        let premIcon = '🔑', premName = '3 Ключа', premType = 'keys', premVal = 3;

        if (lvl === 100) {
            freeIcon = '🎁'; freeName = 'Финал БП ($0.5-$5)'; freeType = 'skin_free'; freeVal = 1;
            premIcon = '👑'; premName = 'GOLD КЕЙС ($2-$25)'; premType = 'skin_prem'; premVal = 1;
        } else {
            if (lvl % 5 === 0) {
                const k = Math.min(8, Math.floor(lvl / 15) + 1);
                freeIcon = '🔑'; freeName = `${k} Ключ${k === 1 ? '' : (k < 5 ? 'а' : 'ей')}`; freeType = 'keys'; freeVal = k;
            } else {
                const c = 500 + (lvl * 50);
                freeIcon = '🪙'; freeName = `${c.toLocaleString()} Монет`; freeType = 'coins'; freeVal = c;
            }
            if (lvl % 2 === 0) {
                const pk = Math.min(20, Math.floor(lvl / 10) + 3);
                premIcon = '🔑'; premName = `${pk} Ключей`; premType = 'keys'; premVal = pk;
            } else {
                const pc = 2500 + (lvl * 150);
                premIcon = '💰'; premName = `${pc.toLocaleString()} Монет`; premType = 'coins'; premVal = pc;
            }
        }

        const isUnlocked = curLvl >= lvl;
        const freeClaimed = state.claimedBp.includes(`f_${lvl}`);
        const premClaimed = state.claimedBp.includes(`p_${lvl}`);

        const col = document.createElement('div');
        col.className = 'bp-col';
        col.innerHTML = `
            <div class="bp-lvl-badge ${isUnlocked ? 'unlocked' : ''}">LVL ${lvl}</div>
            <div class="bp-slot">
                <div class="bp-slot-tag">FREE</div>
                <div class="bp-slot-icon">${freeIcon}</div>
                <div class="bp-slot-name">${freeName}</div>
                <button class="bp-claim-btn" ${(!isUnlocked || freeClaimed) ? 'disabled' : ''} onclick="claimBpReward('f_${lvl}', '${freeType}', ${freeVal})">
                    ${freeClaimed ? 'Забрано' : (isUnlocked ? 'Забрать' : '🔒')}
                </button>
            </div>
            <div class="bp-slot prem">
                <div class="bp-slot-tag">GOLD PASS</div>
                <div class="bp-slot-icon">${premIcon}</div>
                <div class="bp-slot-name">${premName}</div>
                <button class="bp-claim-btn" ${(!isUnlocked || !state.bpPremium || premClaimed) ? 'disabled' : ''} onclick="claimBpReward('p_${lvl}', '${premType}', ${premVal})">
                    ${premClaimed ? 'Забрано' : (!state.bpPremium ? '👑 Gold' : (isUnlocked ? 'Забрать' : '🔒'))}
                </button>
            </div>
        `;
        track.appendChild(col);
    }
}

function claimBpReward(id, type, val) {
    if (state.claimedBp.includes(id)) return;
    state.claimedBp.push(id);
    if (type === 'coins') { state.coins += val; showToast(`Получено +${val.toLocaleString()} монет!`); }
    else if (type === 'keys') { state.keys += val; showToast(`Получено +${val} 🔑!`); }
    else if (type === 'skin_free') {
        state.inventory.push({ name: 'MP9 | Hydra ($0.55)', price: 0.55, sellKeys: 14 });
        showToast('Финальный скин БП добавлен в инвентарь!');
    } else if (type === 'skin_prem') {
        state.inventory.push({ name: 'AWP | Redline ($5.00)', price: 5.00, sellKeys: 110 });
        showToast('👑 Финальный GOLD-скин добавлен в инвентарь!');
    }
    updateUI();
}

function buyPremiumBP() {
    if (state.bpPremium) return showToast('GOLD PASS уже активирован!');
    if (state.stars < 350) return showToast('Нужно 350 ⭐!');
    state.stars -= 350;
    state.bpPremium = true;
    document.getElementById('bpStatus').innerText = '👑 GOLD PASS';
    document.getElementById('buyBpBtn').innerText = '✅ GOLD PASS активен';
    showToast('👑 GOLD PASS активирован!');
    updateUI();
}

function renderInventory() {
    const list = document.getElementById('invList');
    document.getElementById('invCount').innerText = state.inventory.length + ' шт.';
    if (state.inventory.length === 0) {
        list.innerHTML = '<p style="font-size:13px;color:var(--muted);text-align:center;padding:16px 0;">Пока пусто. Открывай кейсы в Магазине!</p>';
        return;
    }
    list.innerHTML = '';
    state.inventory.forEach((item, idx) => {
        const div = document.createElement('div');
        div.className = 'inv-item';
        div.innerHTML = `
            <div>
                <div style="font-size:13px;font-weight:800;">${item.name}</div>
                <div style="font-size:11px;color:var(--green);">$${item.price.toFixed(2)}</div>
            </div>
            <div class="inv-actions">
                <button class="btn btn-dark btn-sm" style="margin:0" onclick="sellSkin(${idx})">+${item.sellKeys} 🔑</button>
                <button class="btn btn-green btn-sm" style="margin:0" onclick="withdrawSkin(${idx})">Вывод</button>
            </div>
        `;
        list.appendChild(div);
    });
}

function sellSkin(idx) {
    const item = state.inventory[idx];
    state.keys += item.sellKeys;
    state.inventory.splice(idx, 1);
    showToast('Скин продан за +' + item.sellKeys + ' 🔑!');
    updateUI();
}

function withdrawSkin(idx) {
    const url = document.getElementById('tradeUrl').value.trim();
    if (!url.includes('://steamcommunity.com')) return showToast('Сначала вставь и сохрани свою Steam Trade URL!');
    const item = state.inventory[idx];
    state.inventory.splice(idx, 1);
    showToast('Заявка на вывод ' + item.name + ' отправлена!');
    updateUI();
}

function saveTradeUrl() {
    const url = document.getElementById('tradeUrl').value.trim();
    if (!url.includes('://steamcommunity.com')) return showToast('Неверная ссылка обмена Steam!');
    showToast('Steam Trade URL сохранена!');
}

function usePromo() {
    const code = document.getElementById('promoCode').value.trim().toUpperCase();
    if (!code) return showToast('Введи промокод!');
    showToast('Проверка промокода на сервере...');
}

initLiveFeed();
buildTrack('12 🔑');
updateUI();
window.addEventListener('beforeunload', () => {
    localStorage.setItem('westyloot_save', JSON.stringify(state));
});
setInterval(() => {
    localStorage.setItem('westyloot_save', JSON.stringify(state));
}, 1000);

