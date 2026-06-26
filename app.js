// --- 状態管理 ---
const state = {
  light: 3,
  standard: 2,
  premium: 1,
  ojtMinutes: 30,       // 訪問時間（分）
  consultMode: 'online', // online | onsite
  chatHours: 1.0,
  targetDaysPerWeek: 4,
};

// --- 定数 ---
const PLANS = {
  light:    { name: 'ライトプラン',    price: 30000, ojt: 1, consult: 1, cls: 'light' },
  standard: { name: 'スタンダードプラン', price: 60000, ojt: 2, consult: 2, cls: 'standard' },
  premium:  { name: 'プレミアムプラン',  price: 100000, ojt: 4, consult: 4, cls: 'premium' },
};

const TRAVEL_BOTH_WAYS = 80; // 分（往復）
const WORK_HOURS_PER_DAY = 8;
const WORK_WEEKS_PER_MONTH = 4.33;
const MAX_CONSECUTIVE_DAYS = 4;

// キャパシティ上限（月稼働日数）
// 年120日休み → 年245日稼働 → 月平均20.4日
const MAX_DAYS_PER_MONTH = 20;
// 週休3日理想 → 週4日 × 4.33週 ≈ 17日/月
const IDEAL_DAYS_PER_MONTH = Math.round(4 * WORK_WEEKS_PER_MONTH);

// --- 計算ロジック ---
function calcOjtHours() {
  const visitMin = state.ojtMinutes;
  return (TRAVEL_BOTH_WAYS + visitMin) / 60;
}

function calcConsultHours() {
  if (state.consultMode === 'online') return 0.5;
  return (TRAVEL_BOTH_WAYS + 30) / 60;
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
    detail[key] = { n, hoursPerClient, hoursTotal, revenue };
  }

  const maxHoursPerMonth = MAX_DAYS_PER_MONTH * WORK_HOURS_PER_DAY; // 160h
  const idealHoursPerMonth = IDEAL_DAYS_PER_MONTH * WORK_HOURS_PER_DAY; // 136h
  const targetHoursPerMonth = state.targetDaysPerWeek * WORK_WEEKS_PER_MONTH * WORK_HOURS_PER_DAY;

  const requiredDays = Math.ceil(totalHours / WORK_HOURS_PER_DAY);
  const weeksPerDay = (requiredDays / WORK_WEEKS_PER_MONTH).toFixed(1);

  const capacityPct = Math.min((totalHours / maxHoursPerMonth) * 100, 110);

  return {
    totalHours,
    totalRevenue,
    totalVisits,
    detail,
    requiredDays,
    weeksPerDay,
    capacityPct,
    maxHoursPerMonth,
    idealHoursPerMonth,
    targetHoursPerMonth,
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

  // ゲージ
  const pct = Math.min(t.capacityPct, 110);
  document.getElementById('gaugeFill').style.width = Math.min(pct, 100) + '%';
  document.getElementById('capacityPercent').textContent = Math.round(t.capacityPct) + '%';

  if (t.capacityPct >= 80) {
    document.getElementById('gaugeFill').style.background = 'linear-gradient(90deg, #4caf50, #f44336)';
  } else if (t.capacityPct >= 60) {
    document.getElementById('gaugeFill').style.background = 'linear-gradient(90deg, #4caf50, #ff9800)';
  } else {
    document.getElementById('gaugeFill').style.background = 'linear-gradient(90deg, #4caf50, #66bb6a)';
  }

  // メッセージ
  const msg = document.getElementById('capacityMessage');
  const daysPerWeek = (t.requiredDays / WORK_WEEKS_PER_MONTH).toFixed(1);
  if (t.capacityPct >= 80) {
    msg.className = 'capacity-message over';
    msg.innerHTML = `🔴 <strong>一人では難しいラインに近づいています</strong><br>月${t.requiredDays}日稼働（週約${daysPerWeek}日）は年120日休みの確保が困難になる可能性があります。`;
  } else if (t.capacityPct >= 60) {
    msg.className = 'capacity-message warn';
    msg.innerHTML = `🟡 <strong>週休3日の理想ラインを超えています</strong><br>月${t.requiredDays}日稼働（週約${daysPerWeek}日）です。目標の週4日を超えていないか確認してください。`;
  } else {
    msg.className = 'capacity-message ok';
    msg.innerHTML = `🟢 <strong>余裕のある稼働です</strong><br>月${t.requiredDays}日稼働（週約${daysPerWeek}日）。週休3日を保ちながら対応できる範囲です。`;
  }

  // 内訳テーブル
  renderBreakdown(t);

  // カレンダー
  renderCalendar(t);

  // 設定表示更新
  document.getElementById('ojtTimeDisplay').textContent = calcOjtHours().toFixed(1) + '時間';
  document.getElementById('consultTimeDisplay').textContent = calcConsultHours().toFixed(1) + '時間';
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

function renderCalendar(t) {
  const wrap = document.getElementById('calendarWrap');
  wrap.innerHTML = '';

  // 凡例
  const legend = document.createElement('div');
  legend.className = 'cal-legend';
  legend.style.gridColumn = '1 / -1';
  legend.innerHTML = `
    <div class="cal-legend-item"><div class="cal-legend-dot" style="background:#e3f2fd;border:1px solid #4a90c4"></div>OJT訪問</div>
    <div class="cal-legend-item"><div class="cal-legend-dot" style="background:#fff3e0;border:1px solid #e8683a"></div>コンサル</div>
    <div class="cal-legend-item"><div class="cal-legend-dot" style="background:#e8f5e9;border:1px solid #4caf50"></div>OJT＋コンサル同日</div>
    <div class="cal-legend-item"><div class="cal-legend-dot" style="background:#fce4ec"></div>休日</div>
  `;
  wrap.appendChild(legend);

  // 曜日ヘッダー
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  const classes = ['sun', '', '', '', '', '', 'sat'];
  days.forEach((d, i) => {
    const h = document.createElement('div');
    h.className = 'cal-header ' + classes[i];
    h.textContent = d;
    wrap.appendChild(h);
  });

  // 2026年7月を基準に（日曜始まり、1日は水曜）
  const startDow = 3; // 2026/7/1は水曜
  const totalDays = 31;

  // 訪問スケジュール生成（連続4勤務以内）
  const totalVisits = t.totalVisits;
  const totalConsults = Object.entries(t.detail).reduce((acc, [k, d]) => acc + d.n * PLANS[k].consult, 0);

  // 稼働日を生成（週5日ベース、連続4まで）
  const workDays = [];
  let consecutive = 0;
  for (let d = 1; d <= totalDays; d++) {
    const dow = (startDow + d - 1) % 7;
    const isWeekend = dow === 0 || dow === 6;
    if (isWeekend) { consecutive = 0; continue; }
    if (consecutive >= MAX_CONSECUTIVE_DAYS) { consecutive = 0; continue; }
    workDays.push(d);
    consecutive++;
  }

  // 訪問日を均等に割り付け
  const visitDays = new Set();
  const consultDays = new Set();
  const step = workDays.length / Math.max(totalVisits, 1);
  for (let i = 0; i < Math.min(totalVisits, workDays.length); i++) {
    visitDays.add(workDays[Math.floor(i * step)]);
  }
  const remainingDays = workDays.filter(d => !visitDays.has(d));
  const cStep = remainingDays.length / Math.max(totalConsults - totalVisits, 1);
  for (let i = 0; i < Math.min(Math.max(totalConsults - totalVisits, 0), remainingDays.length); i++) {
    consultDays.add(remainingDays[Math.floor(i * cStep)]);
  }

  // 空白セル（月初の曜日オフセット）
  for (let i = 0; i < startDow; i++) {
    const empty = document.createElement('div');
    empty.className = 'cal-day empty';
    wrap.appendChild(empty);
  }

  for (let d = 1; d <= totalDays; d++) {
    const dow = (startDow + d - 1) % 7;
    const isWeekend = dow === 0 || dow === 6;
    const isOjt = visitDays.has(d);
    const isConsult = consultDays.has(d);

    const cell = document.createElement('div');
    let cls = 'cal-day';
    let label = '';
    if (isWeekend) { cls += ' holiday'; }
    else if (isOjt && isConsult) { cls += ' both'; label = 'OJT＋相談'; }
    else if (isOjt) { cls += ' ojt'; label = 'OJT'; }
    else if (isConsult) { cls += ' consult'; label = '相談'; }

    cell.className = cls;
    cell.innerHTML = `<span class="cal-date">${d}</span>${label ? `<span class="cal-label">${label}</span>` : ''}`;
    wrap.appendChild(cell);
  }
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
      if (group === 'consult') state.consultMode = value;
      if (group === 'workdays') state.targetDaysPerWeek = parseInt(value);

      update();
    });
  });
}

// --- 初期化 ---
setupEvents();
update();
