const tg = (window.Telegram && window.Telegram.WebApp) ? window.Telegram.WebApp : null;
if (tg) tg.expand();

const ADSGRAM_BLOCK_ID = "";
const BOT_USERNAME = "westyloot_bot";
const ADMIN_CHAT_ID = "5888218785";

let state = {
    coins: 0, keys: 0, stars: 0,
    adsWeek: 0, adsMonth: 0, casesOpened: 0,
    bpPremium: false, dailyUsed: false,
    referrals: 0, refClaimed: false,
    acAdProgress: 0, acSpeed: 2, acEndTime: 0, acLastTick: 0,
    usedPromos: [], inventory: [], claimedBp: []
};

let currentCase = 'free_25';
let isSpinning = false;
let wheelDeg = 0;
let lastWonSkin = null;

const FREE_CASES = {
    free_25:  { title: '📦 Кейс «Новичок»', cost: 25,  k1: 5,  k2: 18,  k3: 35,  k4: 55,  skin: { name: 'P250 | Sand Dune', price: 0.25, sellKeys: 6 },   chance: 0.3 },
    free_50:  { title: '🎒 Кейс «Базовый»', cost: 50,  k1: 12, k2: 38,  k3: 63,  k4: 100, skin: { name: 'Glock-18 | Oxide', price: 0.50, sellKeys: 12 },  chance: 0.5 },
    free_75:  { title: '🎖️ Кейс «Армейский»', cost: 75, k1: 20, k2: 55,  k3: 95,  k4: 150, skin: { name: 'USP-S | Ticket to Hell', price: 1.00, sellKeys: 24 }, chance: 0.6 },
    free_100: { title: '🔫 Кейс «Запрещённый»', cost: 100, k1: 25, k2: 75,  k3: 130, k4: 210, skin: { name: 'AK-47 | Slate', price: 2.50, sellKeys: 55 },   chance: 0.7 },
    free_150: { title: '🔮 Кейс «Засекреченный»', cost: 150, k1: 40, k2: 115, k3: 200, k4: 320, skin: { name: 'M4A1-S | Decimator', price: 4.00, sellKeys: 90 }, chance: 0.8 },
    free_200: { title: '🔥 Кейс «Тайный»', cost: 200, k1: 55, k2: 150, k3: 270, k4: 430, skin: { name: 'AWP | Neo-Noir', price: 6.00, sellKeys: 130 },   chance: 0.9 },
    free_300: { title: '👑 Кейс «Легендарный»', cost: 300, k1: 85, k2: 230, k3: 400, k4: 650, skin: { name: 'Deagle | Printstream', price: 15.00, sellKeys: 320 }, chance: 1.0 }
};

const CASES_CONFIG = {
    donate_start: {
        title: '💠 Кейс «Стартовый»', costText: '50 ⭐', currency: 'stars', cost: 50,
        items: [
            { label: 'P250 | Sand Dune ($0.20)', chance: '70%', tier: '' },
            { label: 'Glock-18 | Oxide ($0.45)', chance: '25%', tier: '' },
            { label: 'M4A4 | Magnesium ($1.50)', chance: '4.5%', tier: 'gold' },
            { label: 'USP-S | Cortex ($5.00)', chance: '0.5%', tier: 'red' }
        ]
    },
    donate_elite: {
        title: '⚡ Кейс «Элитный»', costText: '150 ⭐', currency: 'stars', cost: 150,
        items: [
            { label: 'AWP | Atheris ($0.65)', chance: '65%', tier: '' },
            { label: 'AK-47 | Ice Coaled ($1.70)', chance: '28%', tier: 'gold' },
            { label: 'M4A1-S | Decimator ($4.00)', chance: '6%', tier: 'gold' },
            { label: 'Deagle | Printstream ($15.00)', chance: '1%', tier: 'red' }
        ]
    },
    donate_knife: {
        title: '🗡️ Кейс «Ножевой»', costText: '500 ⭐', currency: 'stars', cost: 500,
        items: [
            { label: 'AK-47 | Redline ($1.80)', chance: '70%', tier: '' },
            { label: 'AWP | Neo-Noir ($5.00)', chance: '22%', tier: 'gold' },
            { label: 'M4A1-S | Hyper Beast ($12)', chance: '7%', tier: 'red' },
            { label: 'AWP | Asiimov ($35.00)', chance: '0.9%', tier: 'red' },
            { label: '★ Нож-бабочка ($100.00)', chance: '0.1%', tier: 'red' }
        ]
    }
};

Object.keys(FREE_CASES).forEach(k => {
    const fc = FREE_CASES[k];
    CASES_CONFIG[k] = {
        title: fc.title, costText: fc.cost + ' 🔑', currency: 'keys', cost: fc.cost,
        items: [
            { label: fc.k1 + ' 🔑', chance: '50%', tier: '' },
            { label: fc.k2 + ' 🔑', chance: '35%', tier: '' },
            { label: fc.k3 + ' 🔑', chance: '10%', tier: 'gold' },
            { label: fc.k4 + ' 🔑', chance: (5 - fc.chance).toFixed(1) + '%', tier: 'gold' },
            { label: `${fc.skin.name} ($${fc.skin.price})`, chance: fc.chance + '%', tier: 'red' }
        ]
    };
});
function isAdmin() {
    const uid = (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) ? String(tg.initDataUnsafe.user.id) : "";
    return uid !== "" && uid === String(ADMIN_CHAT_ID);
}

function showToast(msg) {
    const t = document.getElementById('toast');
    t.innerText = msg;
    t.style.display = 'block';
    setTimeout(() => { t.style.display = 'none'; }, 2600);
}

function runRewardedAd(onComplete) {
    if (ADSGRAM_BLOCK_ID && window.Adsgram) {
        const AdController = window.Adsgram.init({ blockId: ADSGRAM_BLOCK_ID });
        AdController.show().then(() => { onComplete(); }).catch(() => {
            showToast('Досмотри рекламу до конца, чтобы получить награду!');
        });
    } else {
        onComplete();
    }
}

function initReferrals() {
    const uid = (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) ? tg.initDataUnsafe.user.id : '777';
    const inp = document.getElementById('refLinkInput');
    if (inp) inp.value = `https://t.me{BOT_USERNAME}?start=ref_${uid}`;

    const startParam = (tg && tg.initDataUnsafe) ? tg.initDataUnsafe.start_param : '';
    if (startParam && startParam.startsWith('ref_') && !state.refClaimed) {
        state.refClaimed = true;
        state.keys += 3;
        showToast('🎁 Бонус по ссылке друга: +3 🔑!');
    }
}

function copyRefLink() {
    const input = document.getElementById('refLinkInput');
    input.select();
    navigator.clipboard.writeText(input.value);
    showToast('Реферальная ссылка скопирована!');
}

function pushLiveDrop(user, item, rarity = 'pink') {
    const feed = document.getElementById('liveFeed');
    if (!feed) return;
    if (feed.dataset.empty === '1') { feed.innerHTML = ''; feed.dataset.empty = '0'; }
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
function switchTab(tabId, btn) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
    document.getElementById('tab-' + tabId).classList.add('active');
    btn.classList.add('active');
    if (tabId === 'shop') selectCase(currentCase, true);
    if (tabId === 'bp') renderBattlePass();
}

function getCurrentBpLevel() {
    const lvlByCases = Math.floor((state.casesOpened / 200) * 100);
    const lvlByAds = Math.floor((state.adsMonth / 50) * 100);
    return Math.min(100, Math.max(1, Math.min(lvlByCases, lvlByAds) + 1));
}

function updateUI() {
    document.getElementById('coins').innerText = Math.floor(state.coins).toLocaleString();
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
    showToast('Ручной клик отключён — запусти автокликер ниже!');
}

function exchangeKey() {
    if (state.coins < 8500) return showToast('Нужно 8 500 монет!');
    state.coins -= 8500;
    state.keys += 1;
    showToast('Обменяли 8 500 монет на 1 ключ!');
    updateUI();
}

function watchAd() {
    runRewardedAd(() => {
        const won = Math.random() < 0.35 ? 2 : 1;
        state.keys += won;
        state.adsWeek += 1;
        state.adsMonth += 1;
        showToast('Реклама просмотрена! +' + won + ' 🔑');
        updateUI();
    });
}

function stepFreeAutoClicker() {
    if (state.acEndTime && state.acEndTime > Date.now()) return showToast('Автокликер уже запущен!');
    runRewardedAd(() => {
        state.acAdProgress = (state.acAdProgress || 0) + 1;
        state.adsWeek += 1;
        state.adsMonth += 1;
        if (state.acAdProgress >= 5) {
            state.acAdProgress = 0;
            state.acSpeed = 2;
            state.acEndTime = Date.now() + 3600 * 1000;
            state.acLastTick = Date.now();
            showToast('🤖 Автокликер (2 кл/с) запущен на 1 час!');
        } else {
            showToast(`Прогресс автокликера: ${state.acAdProgress} / 5 реклам`);
        }
        updateUI();
    });
}

function buyVipAutoClicker() {
    if (state.stars < 100) return showToast('Нужно 100 ⭐!');
    state.stars -= 100;
    state.acSpeed = 5;
    state.acEndTime = Date.now() + 5 * 3600 * 1000;
    state.acLastTick = Date.now();
    showToast('⚡ VIP Автокликер (5 кл/с) запущен на 5 часов!');
    updateUI();
}
function selectCase(caseKey, silent = false) {
    if (isSpinning) return;
    currentCase = caseKey;
    const cfg = CASES_CONFIG[caseKey];
    document.getElementById('activeCaseTitle').innerText = cfg.title;
    document.getElementById('activeCasePrice').innerText = cfg.costText;
    buildTrack('5 🔑');

    const grid = document.getElementById('caseContents');
    if (grid) {
        grid.innerHTML = cfg.items.map(it => `
            <div class="c-chip ${it.tier}">
                <div class="c-name">${it.label}</div>
                <div class="c-chance">${it.chance}</div>
            </div>
        `).join('');
    }
    if (!silent) showToast('Выбран: ' + cfg.title);
}

function buildTrack(winText) {
    const track = document.getElementById('track');
    track.style.transition = 'none';
    track.style.transform = 'translateX(0px)';
    track.innerHTML = '';

    const pool = CASES_CONFIG[currentCase].items.map(i => i.label);
    for (let i = 0; i < 35; i++) {
        const div = document.createElement('div');
        let label = (i === 28) ? winText : pool[Math.floor(Math.random() * pool.length)];
        let isRare = label.includes('$5') || label.includes('$6') || label.includes('$15') || label.includes('$35') || label.includes('$100');
        let isSkin = label.includes('$');
        div.className = 'r-item' + (isRare ? ' red' : (isSkin ? ' gold' : ''));
        div.innerText = label;
        track.appendChild(div);
    }
}

function openWinModal(skinObj) {
    lastWonSkin = skinObj;
    document.getElementById('modalIcon').innerText = skinObj.name.includes('Нож') ? '🗡️' : '🔫';
    document.getElementById('modalTitle').innerText = skinObj.name;
    document.getElementById('modalPrice').innerText = '$' + skinObj.price.toFixed(2);
    document.getElementById('modalSellBtn').innerText = `💰 Продать за +${skinObj.sellKeys} 🔑`;
    document.getElementById('winModal').style.display = 'flex';
}

function closeWinModal(sellImmediately) {
    document.getElementById('winModal').style.display = 'none';
    if (!lastWonSkin) return;
    if (sellImmediately) {
        state.keys += lastWonSkin.sellKeys;
        showToast(`Продано за +${lastWonSkin.sellKeys} 🔑!`);
    } else {
        state.inventory.push(lastWonSkin);
        showToast('Скин добавлен в инвентарь!');
    }
    lastWonSkin = null;
    updateUI();
}

function spinSelectedCase(isFast = false) {
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

    if (FREE_CASES[currentCase]) {
        const fc = FREE_CASES[currentCase];
        if (roll < 50) { winKeys = fc.k1; winText = winKeys + ' 🔑'; }
        else if (roll < 85) { winKeys = fc.k2; winText = winKeys + ' 🔑'; }
        else if (roll < 95) { winKeys = fc.k3; winText = winKeys + ' 🔑'; }
        else if (roll < (100 - fc.chance)) { winKeys = fc.k4; winText = winKeys + ' 🔑'; }
        else { winText = `${fc.skin.name} ($${fc.skin.price})`; skinObj = { ...fc.skin }; }
    } else if (currentCase === 'donate_start') {
        if (roll < 70) { winText = 'P250 | Sand Dune ($0.20)'; skinObj = { name: 'P250 | Sand Dune', price: 0.20, sellKeys: 5 }; }
        else if (roll < 95) { winText = 'Glock-18 | Oxide ($0.45)'; skinObj = { name: 'Glock-18 | Oxide', price: 0.45, sellKeys: 12 }; }
        else if (roll < 99.5) { winText = 'M4A4 | Magnesium ($1.50)'; skinObj = { name: 'M4A4 | Magnesium', price: 1.50, sellKeys: 35 }; }
        else { winText = 'USP-S | Cortex ($5.00)'; skinObj = { name: 'USP-S | Cortex', price: 5.00, sellKeys: 110 }; }
    } else if (currentCase === 'donate_elite') {
        if (roll < 65) { winText = 'AWP | Atheris ($0.65)'; skinObj = { name: 'AWP | Atheris', price: 0.65, sellKeys: 16 }; }
        else if (roll < 93) { winText = 'AK-47 | Ice Coaled ($1.70)'; skinObj = { name: 'AK-47 | Ice Coaled', price: 1.70, sellKeys: 40 }; }
        else if (roll < 99) { winText = 'M4A1-S | Decimator ($4.00)'; skinObj = { name: 'M4A1-S | Decimator', price: 4.00, sellKeys: 90 }; }
        else { winText = 'Deagle | Printstream ($15.00)'; skinObj = { name: 'Deagle | Printstream', price: 15.00, sellKeys: 320 }; }
    } else if (currentCase === 'donate_knife') {
        if (roll < 70) { winText = 'AK-47 | Redline ($1.80)'; skinObj = { name: 'AK-47 | Redline', price: 1.80, sellKeys: 42 }; }
        else if (roll < 92) { winText = 'AWP | Neo-Noir ($5.00)'; skinObj = { name: 'AWP | Neo-Noir', price: 5.00, sellKeys: 110 }; }
        else if (roll < 99) { winText = 'M4A1-S | Hyper Beast ($12)'; skinObj = { name: 'M4A1-S | Hyper Beast', price: 12.00, sellKeys: 260 }; }
        else if (roll < 99.9) { winText = 'AWP | Asiimov ($35.00)'; skinObj = { name: 'AWP | Asiimov', price: 35.00, sellKeys: 750 }; }
        else { winText = '★ Нож-бабочка ($100.00)'; skinObj = { name: '★ Нож-бабочка', price: 100.00, sellKeys: 2000 }; }
    }

    buildTrack(winText);
    const track = document.getElementById('track');
    const wrapWidth = track.parentElement.offsetWidth;
    const itemWidth = 94;
    const targetOffset = (28 * itemWidth) + (itemWidth / 2) - (wrapWidth / 2);
    const duration = isFast ? 350 : 3500;

    setTimeout(() => {
        track.style.transition = `transform ${duration}ms cubic-bezier(0.15, 0.85, 0.25, 1)`;
        track.style.transform = `translateX(-${targetOffset}px)`;
    }, 30);

    setTimeout(() => {
        isSpinning = false;
        if (skinObj) {
            const rType = skinObj.price >= 50 ? 'gold' : (skinObj.price >= 5 ? 'rare' : 'pink');
            pushLiveDrop('@Вы', skinObj.name, rType);
            openWinModal(skinObj);
        } else {
            state.keys += winKeys;
            showToast('Выпало: ' + winKeys + ' 🔑');
            updateUI();
        }
    }, duration + 120);
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
    runRewardedAd(() => {
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
                pushLiveDrop('@Вы', 'M4A1-S | Player Two', 'rare');
                openWinModal({ name: 'M4A1-S | Player Two', price: 5.0, sellKeys: 110 });
            } else {
                state.keys += bonusKeys;
                showToast('🎡 Колесо остановилось: +' + bonusKeys + ' 🔑!');
                updateUI();
            }
        }, 4100);
    });
}

function renderBattlePass() {
    const track = document.getElementById('bpTrack');
    if (!track) return;
    const curLvl = getCurrentBpLevel();
    track.innerHTML = '';

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
    const uname = (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) ? '@' + (tg.initDataUnsafe.user.username || tg.initDataUnsafe.user.id) : 'Игрок';
    state.inventory.splice(idx, 1);

    if (tg && tg.sendData) {
        try { tg.sendData(JSON.stringify({ action: 'withdraw', adminId: ADMIN_CHAT_ID, user: uname, skin: item.name, price: item.price, tradeUrl: url })); } catch (e) {}
    }
    showToast(`Заявка на вывод ${item.name} отправлена админу!`);
    updateUI();
}

function saveTradeUrl() {
    const url = document.getElementById('tradeUrl').value.trim();
    if (!url.includes('://steamcommunity.com')) return showToast('Неверная ссылка обмена Steam!');
    localStorage.setItem('westyloot_trade', url);
    showToast('Steam Trade URL сохранена!');
}

function usePromo() {
    const code = document.getElementById('promoCode').value.trim().toUpperCase();
    if (!code) return showToast('Введи промокод!');
    if (!state.usedPromos) state.usedPromos = [];

    if (code === 'ADMINTEST' && isAdmin()) {
        state.keys += 500;
        state.stars += 1000;
        document.getElementById('promoCode').value = '';
        showToast('👑 Админ-тест: +500 🔑 и +1000 ⭐!');
        updateUI();
        return;
    }

    if (state.usedPromos.includes(code)) return showToast('Ты уже активировал этот промокод!');

    const PROMOS = {
        'WESTYSTART': { keys: 5, coins: 5000 },
        'STANDOFF2':  { keys: 3, coins: 10000 }
    };

    if (PROMOS[code]) {
        state.usedPromos.push(code);
        state.keys += PROMOS[code].keys;
        state.coins += PROMOS[code].coins;
        document.getElementById('promoCode').value = '';
        showToast(`Промокод активирован! +${PROMOS[code].keys} 🔑 и +${PROMOS[code].coins.toLocaleString()} монет`);
        updateUI();
    } else {
        showToast('Неверный промокод');
    }
}

setInterval(() => {
    const statusEl = document.getElementById('acStatus');
    const freeBtn = document.getElementById('acFreeBtn');
    const coinEl = document.getElementById('coinVisual');
    if (!statusEl || !freeBtn) return;

    const now = Date.now();
    if (state.acEndTime && state.acEndTime > now) {
        const speed = state.acSpeed || 2;
        const last = state.acLastTick || now;
        const secPassed = Math.max(1, Math.floor((now - last) / 1000));
        state.acLastTick = now;
        state.coins += speed * secPassed;
        document.getElementById('coins').innerText = Math.floor(state.coins).toLocaleString();
        if (coinEl) coinEl.classList.add('mining');

        const leftSec = Math.floor((state.acEndTime - now) / 1000);
        const h = String(Math.floor(leftSec / 3600)).padStart(2, '0');
        const m = String(Math.floor((leftSec % 3600) / 60)).padStart(2, '0');
        const s = String(leftSec % 60).padStart(2, '0');
        statusEl.innerText = `🟢 +${speed} кл/с (${h}:${m}:${s})`;
        statusEl.style.color = 'var(--green)';
        freeBtn.innerText = '🤖 Автокликер уже работает';
        saveProgress();
    } else {
        if (coinEl) coinEl.classList.remove('mining');
        const prog = state.acAdProgress || 0;
        statusEl.innerText = 'Не активен';
        statusEl.style.color = 'var(--muted)';
        freeBtn.innerText = `🎬 Автокликер (2 кл/с на 1ч): ${prog} / 5 реклам`;
    }
}, 1000);

let isCloudLoaded = false;
const API_BASE = "https://pythonanywhere.com";
let isCloudLoaded = false;
let saveTimer = null;

function getPlayerId() {
    if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
        return String(tg.initDataUnsafe.user.id);
    }
    return "guest_777";
}

function saveProgress() {
    if (!isCloudLoaded) return;
    const raw = JSON.stringify(state);
    try { localStorage.setItem('westyloot_save', raw); } catch (e) {}
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        fetch(`${API_BASE}/save/${getPlayerId()}`, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: raw
        }).catch(() => {});
    }, 600);
}

const origUpdateUI = updateUI;
updateUI = function() {
    origUpdateUI();
    saveProgress();
};

initLiveFeed();
initReferrals();
selectCase('free_25', true);

const savedTrade = localStorage.getItem('westyloot_trade');
if (savedTrade && document.getElementById('tradeUrl')) document.getElementById('tradeUrl').value = savedTrade;

fetch(`${API_BASE}/load/${getPlayerId()}`)
    .then(r => r.json())
    .then(serverData => {
        if (serverData && Object.keys(serverData).length > 0) {
            state = { ...state, ...serverData };
        }
        isCloudLoaded = true;
        origUpdateUI();
    })
    .catch(() => {
        try {
            const localRaw = localStorage.getItem('westyloot_save');
            if (localRaw) state = { ...state, ...JSON.parse(localRaw) };
        } catch (e) {}
        isCloudLoaded = true;
        origUpdateUI();
    });

