// --- 状態管理 ---
const state = {
  light: 3,
  standard: 2,
  premium: 1,
  ojtMinutes: 30,            // 訪問時間（分）
  ojtTravelMinutes: 60,      // OJT往復移動時間（分）60 | 90 | 120
  consultTravelMinutes: 60,  // コンサル往復移動時間（分）60 | 90 | 120
  consultMode: 'online',     // online | onsite
  chatHours: 1.0,
};

// --- 定数 ---
const PLANS = {
  light:    { name: 'ライトプラン',    price: 30000, ojt: 1, consult: 1, cls: 'light' },
  standard: { name: 'スタンダードプラン', price: 60000, ojt: 2, consult: 2, cls: 'standard' },
  premium:  { name: 'プレミアムプラン',  price: 100000, ojt: 4, consult: 4, cls: 'premium' },
};

const WORK_HOURS_PER_DAY = 8;
const WORK_WEEKS_PER_MONTH = 4.33;
const MAX_CONSECUTIVE_DAYS = 4;

// キャパシティ上限（月稼働日数）
// 年120日休み → 年245日稼働 → 月平均20.4日
const MAX_DAYS_PER_MONTH = 20;       // 週5日（物理的限界）
// 週休3日理想 → 週4日 × 4.33週 ≈ 17日/月
const IDEAL_DAYS_PER_MONTH = Math.round(4 * WORK_WEEKS_PER_MONTH);
// ゲージ右側の余白（赤ゾーンを見せるため限界の先まで表示）：週6日相当
const GAUGE_MAX_DAYS = Math.round(6 * WORK_WEEKS_PER_MONTH);

// --- 計算ロジック ---
function calcOjtHours() {
  const visitMin = state.ojtMinutes;
  return (state.ojtTravelMinutes + visitMin) / 60;
}

function calcConsultHours() {
  if (state.consultMode === 'online') return 0.5;
  return (state.consultTravelMinutes + 30) / 60;
}

function calcPlanHours(planKey) {
  const p = PLANS[planKey];
  const ojtH = calcOjtHours();
  const consultH = calcConsultHours();
  return p.ojt * ojtH + p.consult * consultH + state.chatHours;
}

function calcTotals() {
  const counts = { light: state.light, standard: state.standard, premium: state.premium };
  let totalHours = 0;
  let totalRevenue = 0;
  let totalVisits = 0;
  let totalConsults = 0;

  const detail = {};
  for (const key of ['light', 'standard', 'premium']) {
    const n = counts[key];
    const p = PLANS[key];
    const hoursPerClient = calcPlanHours(key);
    const hoursTotal = n * hoursPerClient;
    const revenue = n * p.price;
    totalHours += hoursTotal;
    totalRevenue += revenue;
    totalVisits += n * p.ojt;
    totalConsults += n * p.consult;
    detail[key] = { n, hoursPerClient, hoursTotal, revenue };
  }

  const totalBusinesses = counts.light + counts.standard + counts.premium;
  const totalChatHours = state.chatHours * totalBusinesses; // 月のチャット合計時間

  const maxHoursPerMonth = MAX_DAYS_PER_MONTH * WORK_HOURS_PER_DAY;   // 160h（週5＝物理的限界）
  const idealHoursPerMonth = IDEAL_DAYS_PER_MONTH * WORK_HOURS_PER_DAY; // 136h（週4＝週休3日）
  const gaugeMaxHours = GAUGE_MAX_DAYS * WORK_HOURS_PER_DAY;          // 208h（週6相当・ゲージ右端）

  const requiredDays = Math.ceil(totalHours / WORK_HOURS_PER_DAY);
  const weeksPerDay = (requiredDays / WORK_WEEKS_PER_MONTH).toFixed(1);

  // 限界（週5）に対する割合：%表示・判定に使う
  const capacityPct = (totalHours / maxHoursPerMonth) * 100;
  // ゲージ上の位置（右端=週6相当）
  const week4TrackPct = (idealHoursPerMonth / gaugeMaxHours) * 100; // ≈65%
  const week5TrackPct = (maxHoursPerMonth / gaugeMaxHours) * 100;   // ≈77%
  const fillTrackPct = Math.min((totalHours / gaugeMaxHours) * 100, 100);

  return {
    totalHours,
    totalRevenue,
    totalVisits,
    totalConsults,
    totalChatHours,
    detail,
    requiredDays,
    weeksPerDay,
    capacityPct,
    maxHoursPerMonth,
    idealHoursPerMonth,
    week4TrackPct,
    week5TrackPct,
    fillTrackPct,
  };
}

// --- UI更新 ---
function update() {
  const t = calcTotals();

  // サマリー
  document.getElementById('monthlyRevenue').textContent = '¥' + t.totalRevenue.toLocaleString();
  document.getElementById('annualRevenue').textContent = '年商 ¥' + (t.totalRevenue * 12).toLocaleString();
  document.getElementById('monthlyHours').textContent = t.totalHours.toFixed(1) + '時間';

  const avgDailyH = t.requiredDays > 0 ? (t.totalHours / t.requiredDays).toFixed(1) : '0.0';
  document.getElementById('dailyHoursAvg').textContent = `平均 ${avgDailyH}時間/日`;
  document.getElementById('requiredDays').textContent = t.requiredDays + '日/月';
  document.getElementById('weeksInfo').textContent = `週${t.weeksPerDay}日ペース`;
  document.getElementById('totalVisits').textContent = t.totalVisits + '件';
  document.getElementById('totalConsults').textContent = t.totalConsults + '枠';

  // ゲージ：🟢〜週4日 / 🟡週4〜週5 / 🔴週5超（週6相当が右端）
  const w4 = t.week4TrackPct; // ≈65%
  const w5 = t.week5TrackPct; // ≈77%
  document.getElementById('zoneGreen').style.width = w4 + '%';
  document.getElementById('zoneYellow').style.left = w4 + '%';
  document.getElementById('zoneYellow').style.width = (w5 - w4) + '%';
  document.getElementById('zoneRed').style.left = w5 + '%';
  document.getElementById('zoneRed').style.width = (100 - w5) + '%';
  document.getElementById('idealMarker').style.left = w4 + '%';
  document.getElementById('limitMarker').style.left = w5 + '%';

  document.getElementById('gaugeFill').style.width = t.fillTrackPct + '%';
  document.getElementById('capacityPercent').textContent = Math.round(t.capacityPct) + '%';

  if (t.capacityPct >= 100) {
    document.getElementById('gaugeFill').style.background = 'linear-gradient(90deg, #ff9800, #f44336)';
  } else if (t.capacityPct >= 85) {
    document.getElementById('gaugeFill').style.background = 'linear-gradient(90deg, #4caf50, #ff9800)';
  } else {
    document.getElementById('gaugeFill').style.background = 'linear-gradient(90deg, #4caf50, #66bb6a)';
  }

  // メッセージ（85%≒週4、100%＝週5）
  const msg = document.getElementById('capacityMessage');
  const daysPerWeek = (t.requiredDays / WORK_WEEKS_PER_MONTH).toFixed(1);
  if (t.capacityPct >= 100) {
    msg.className = 'capacity-message over';
    msg.innerHTML = `🔴 <strong>週5日（物理的限界）を超えています</strong><br>月${t.requiredDays}日稼働（週約${daysPerWeek}日）。年120日の休みや「連続4勤務以内」の確保が困難です。増員や契約調整を検討してください。`;
  } else if (t.capacityPct >= 85) {
    msg.className = 'capacity-message warn';
    msg.innerHTML = `🟡 <strong>週4日（週休3日）を超え、限界に近づいています</strong><br>月${t.requiredDays}日稼働（週約${daysPerWeek}日）。一人で対応は可能ですが、理想より忙しい状態です。`;
  } else {
    msg.className = 'capacity-message ok';
    msg.innerHTML = `🟢 <strong>週休3日を守れる範囲です（週4日以内）</strong><br>月${t.requiredDays}日稼働（週約${daysPerWeek}日）。理想の働き方を保ちながら対応できます。`;
  }

  // 内訳テーブル
  renderBreakdown(t);

  // カレンダー
  renderCalendar(t);

  // 設定表示更新
  document.getElementById('ojtTravelDisplay').textContent = state.ojtTravelMinutes;
  document.getElementById('ojtTimeDisplay').textContent = calcOjtHours().toFixed(1) + '時間';
  document.getElementById('consultTimeDisplay').textContent = calcConsultHours().toFixed(1) + '時間';
  // コンサル往復移動トグルは「現地」選択時のみ表示
  document.getElementById('consultTravelItem').style.display =
    state.consultMode === 'onsite' ? '' : 'none';
}

function renderBreakdown(t) {
  const tbody = document.getElementById('breakdownBody');
  const tfoot = document.getElementById('breakdownFoot');
  tbody.innerHTML = '';

  for (const key of ['light', 'standard', 'premium']) {
    const p = PLANS[key];
    const d = t.detail[key];
    if (d.n === 0) continue;
    const tr = document.createElement('tr');
    const ojtH = calcOjtHours().toFixed(1);
    const conH = calcConsultHours().toFixed(1);
    tr.innerHTML = `
      <td><span class="plan-badge ${p.cls}">${p.name}</span></td>
      <td>${d.n}</td>
      <td>${p.ojt}回 × ${ojtH}h = ${(p.ojt * calcOjtHours()).toFixed(1)}h</td>
      <td>${p.consult}枠 × ${conH}h = ${(p.consult * calcConsultHours()).toFixed(1)}h</td>
      <td>${state.chatHours.toFixed(1)}h</td>
      <td><strong>${d.hoursTotal.toFixed(1)}h</strong></td>
      <td>¥${d.revenue.toLocaleString()}</td>
    `;
    tbody.appendChild(tr);
  }

  tfoot.innerHTML = `
    <tr>
      <td colspan="5">合計</td>
      <td>${t.totalHours.toFixed(1)}h</td>
      <td>¥${t.totalRevenue.toLocaleString()}</td>
    </tr>
  `;
}

// ===== カレンダー（ドラッグで配置できるチップ式） =====
const CAL = {
  startDow: 3,    // 2026/7/1は水曜（0=日,1=月,...,6=土）
  totalDays: 31,
  maxPerDay: 5,   // 1日のスロット数（並べられる上限）
  storageKey: 'syncalab-cal-placement-v3',
};

// placement: { [day]: ['ojt'|'consult'|'chat'|null × maxPerDay] }（スロット位置を保持）
let calPlacement = null;
let calCounts = { ojt: null, consult: null, chat: null };

// 空スロット配列を生成
function newSlots() { return new Array(CAL.maxPerDay).fill(null); }

// 長さ maxPerDay（空きはnull）に正規化
function ensureSlots(arr) {
  for (let i = 0; i < CAL.maxPerDay; i++) if (arr[i] === undefined) arr[i] = null;
  arr.length = CAL.maxPerDay;
  return arr;
}

// 稼働日（週末除外・連続4勤務以内）を返す
function calWorkDays() {
  const days = [];
  let consecutive = 0;
  for (let d = 1; d <= CAL.totalDays; d++) {
    const dow = (CAL.startDow + d - 1) % 7;
    const isWeekend = dow === 0 || dow === 6;
    if (isWeekend) { consecutive = 0; continue; }
    if (consecutive >= MAX_CONSECUTIVE_DAYS) { consecutive = 0; continue; }
    days.push(d);
    consecutive++;
  }
  return days;
}

// 初期自動配置（チャットは毎稼働日、OJT・コンサルは均等割り付け、空きスロットの先頭へ）
function autoPlace(totalVisits, totalConsults, hasChat) {
  const workDays = calWorkDays();
  const placement = {};
  workDays.forEach(d => { placement[d] = newSlots(); });
  // チャット：毎稼働日に1つ（先頭スロット）
  if (hasChat) workDays.forEach(d => { placement[d][0] = 'chat'; });
  const placeEven = (count, type) => {
    if (count <= 0 || workDays.length === 0) return;
    const stepN = workDays.length / count;
    for (let i = 0; i < count; i++) {
      const startIdx = Math.floor(i * stepN) % workDays.length;
      for (let k = 0; k < workDays.length; k++) {
        const d = workDays[(startIdx + k) % workDays.length];
        const slot = placement[d].indexOf(null);
        if (slot !== -1) { placement[d][slot] = type; break; }
      }
    }
  };
  placeEven(totalVisits, 'ojt');
  placeEven(totalConsults, 'consult');
  return placement;
}

function loadPlacement() {
  try {
    const raw = localStorage.getItem(CAL.storageKey);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

function savePlacement() {
  try {
    localStorage.setItem(CAL.storageKey, JSON.stringify({
      ojt: calCounts.ojt, consult: calCounts.consult, chat: calCounts.chat, placement: calPlacement,
    }));
  } catch (e) { /* ストレージ不可でも続行 */ }
}

// 件数に応じて配置を用意（初回は保存から復元、件数が変わったら自動再配置）
function ensurePlacement(totalVisits, totalConsults, chatCount) {
  if (calPlacement === null) {
    const saved = loadPlacement();
    if (saved && saved.ojt === totalVisits && saved.consult === totalConsults && saved.chat === chatCount) {
      calPlacement = saved.placement;
      calCounts = { ojt: totalVisits, consult: totalConsults, chat: chatCount };
      return;
    }
  }
  if (calPlacement === null || calCounts.ojt !== totalVisits || calCounts.consult !== totalConsults || calCounts.chat !== chatCount) {
    calPlacement = autoPlace(totalVisits, totalConsults, chatCount > 0);
    calCounts = { ojt: totalVisits, consult: totalConsults, chat: chatCount };
    savePlacement();
  }
}

// チップを (fromDay, fromSlot) → (toDay, toSlot) へ移動。空きなら配置、埋まっていれば入れ替え
function moveChip(fromDay, fromSlot, toDay, toSlot) {
  fromDay = String(fromDay); toDay = String(toDay);
  fromSlot = Number(fromSlot); toSlot = Number(toSlot);
  if (!calPlacement[fromDay]) return false;
  ensureSlots(calPlacement[fromDay]);
  const chip = calPlacement[fromDay][fromSlot];
  if (!chip) return false;
  if (fromDay === toDay && fromSlot === toSlot) return false;
  if (!calPlacement[toDay]) calPlacement[toDay] = newSlots();
  ensureSlots(calPlacement[toDay]);
  const target = calPlacement[toDay][toSlot]; // 入れ替え相手（空きならnull）
  calPlacement[toDay][toSlot] = chip;
  calPlacement[fromDay][fromSlot] = target || null;
  savePlacement();
  return true;
}

function renderCalendar(t) {
  const wrap = document.getElementById('calendarWrap');

  // チャット対応：月合計を稼働日数で割り、1チップあたりの目安（分/日）を表示
  const workDaysArr = calWorkDays();
  const perDayChatMin = workDaysArr.length > 0 ? Math.round(t.totalChatHours * 60 / workDaysArr.length) : 0;
  const chatLabel = perDayChatMin >= 60
    ? `チャット 約${(perDayChatMin / 60).toFixed(1)}h`
    : `チャット 約${perDayChatMin}分`;
  const chatCount = (t.totalChatHours > 0) ? workDaysArr.length : 0; // チャットチップ数（毎稼働日に1つ）

  ensurePlacement(t.totalVisits, t.totalConsults, chatCount);
  wrap.innerHTML = '';

  // 凡例
  const legend = document.createElement('div');
  legend.className = 'cal-legend';
  legend.style.gridColumn = '1 / -1';
  legend.innerHTML = `
    <div class="cal-legend-item"><div class="cal-legend-dot" style="background:#e3f2fd;border:1px solid #4a90c4"></div>OJT訪問</div>
    <div class="cal-legend-item"><div class="cal-legend-dot" style="background:#fff3e0;border:1px solid #e8683a"></div>コンサル</div>
    <div class="cal-legend-item"><div class="cal-legend-dot" style="background:#e8f5e9;border:1px solid #43a047"></div>チャット</div>
    <div class="cal-legend-item"><div class="cal-legend-dot" style="background:#fce4ec"></div>休日</div>
  `;
  wrap.appendChild(legend);

  // 曜日ヘッダー（月曜始まり）
  const days = ['月', '火', '水', '木', '金', '土', '日'];
  const classes = ['', '', '', '', '', 'sat', 'sun'];
  days.forEach((d, i) => {
    const h = document.createElement('div');
    h.className = 'cal-header ' + classes[i];
    h.textContent = d;
    wrap.appendChild(h);
  });

  // 月初の曜日オフセット（月曜始まり）
  const startOffset = (CAL.startDow + 6) % 7;
  for (let i = 0; i < startOffset; i++) {
    const empty = document.createElement('div');
    empty.className = 'cal-day empty';
    wrap.appendChild(empty);
  }

  for (let d = 1; d <= CAL.totalDays; d++) {
    const dow = (CAL.startDow + d - 1) % 7;
    const isWeekend = dow === 0 || dow === 6;
    const slots = calPlacement[d] || [];

    const cell = document.createElement('div');
    cell.className = 'cal-day' + (isWeekend ? ' holiday' : '');
    cell.dataset.day = d;

    const chipText = { ojt: 'OJT', consult: 'コンサル', chat: chatLabel };
    let slotsHtml = '';
    for (let s = 0; s < CAL.maxPerDay; s++) {
      const type = slots[s];
      slotsHtml += `<div class="cal-slot${type ? '' : ' empty-slot'}" data-day="${d}" data-slot="${s}">` +
        (type ? `<div class="chip ${type}" data-day="${d}" data-slot="${s}">${chipText[type]}</div>` : '') +
        `</div>`;
    }

    cell.innerHTML = `<span class="cal-date">${d}</span><div class="cal-chips">${slotsHtml}</div>`;
    wrap.appendChild(cell);
  }
}

// ドラッグ配置（マウス・タッチ両対応：ポインターイベント）
function setupCalendarDrag() {
  const wrap = document.getElementById('calendarWrap');
  let drag = null;

  wrap.addEventListener('pointerdown', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    e.preventDefault();

    const clone = chip.cloneNode(true);
    clone.classList.add('chip-dragging');
    document.body.appendChild(clone);
    const place = (x, y) => { clone.style.left = x + 'px'; clone.style.top = y + 'px'; };
    place(e.clientX, e.clientY);
    chip.classList.add('chip-source');

    drag = { fromDay: chip.dataset.day, fromSlot: chip.dataset.slot, clone, place };

    const clearTargets = () =>
      document.querySelectorAll('.cal-slot.drop-target').forEach(c => c.classList.remove('drop-target'));

    const slotUnder = (x, y) => {
      const under = document.elementFromPoint(x, y);
      return under && under.closest ? under.closest('.cal-slot') : null;
    };

    const onMove = (ev) => {
      drag.place(ev.clientX, ev.clientY);
      clearTargets();
      const slot = slotUnder(ev.clientX, ev.clientY);
      if (slot && slot.dataset.day) slot.classList.add('drop-target');
    };

    const onUp = (ev) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      const slot = slotUnder(ev.clientX, ev.clientY);
      drag.clone.remove();
      clearTargets();
      if (slot && slot.dataset.day) {
        moveChip(drag.fromDay, drag.fromSlot, slot.dataset.day, slot.dataset.slot);
      }
      drag = null;
      update(); // 再描画
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  });
}

// --- イベント設定 ---
function setupEvents() {
  // スライダー
  ['light', 'standard', 'premium'].forEach(key => {
    const el = document.getElementById(key + 'Count');
    const disp = document.getElementById(key + 'Display');
    el.addEventListener('input', () => {
      state[key] = parseInt(el.value);
      disp.textContent = el.value;
      update();
    });
  });

  document.getElementById('chatTime').addEventListener('input', function() {
    state.chatHours = parseFloat(this.value);
    document.getElementById('chatTimeDisplay').textContent = parseFloat(this.value).toFixed(1);
    update();
  });

  // トグルボタン
  document.querySelectorAll('.toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const group = btn.dataset.group;
      const value = btn.dataset.value;
      document.querySelectorAll(`.toggle[data-group="${group}"]`).forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      if (group === 'ojt') state.ojtMinutes = parseInt(value);
      if (group === 'ojtTravel') state.ojtTravelMinutes = parseInt(value);
      if (group === 'consultTravel') state.consultTravelMinutes = parseInt(value);
      if (group === 'consult') state.consultMode = value;

      update();
    });
  });
}

// --- 初期化 ---
setupEvents();
setupCalendarDrag();
update();
