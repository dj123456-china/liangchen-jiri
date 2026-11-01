/* 良辰吉日：本地历法引擎（lunar-javascript）+ 浏览器端筛选，不依赖后端。 */
const { Solar } = window;

const eventConfig = {
  婚嫁: { terms: ['嫁娶', '订婚', '订盟', '纳采'], good: ['嫁娶', '订盟', '纳采', '祭祀'], avoid: ['动土', '破土', '安葬'] },
  乔迁: { terms: ['入宅', '移徙', '安床', '安门'], good: ['入宅', '移徙', '安床', '纳财'], avoid: ['开仓', '安葬', '破土'] },
  开业: { terms: ['开市', '开业', '交易', '立券'], good: ['开市', '交易', '立券', '纳财'], avoid: ['动土', '安葬', '词讼'] },
  出行: { terms: ['出行', '乘船', '渡水', '会亲友'], good: ['出行', '会亲友', '求财', '祈福'], avoid: ['嫁娶', '安葬', '动土'] },
  订婚: { terms: ['订婚', '订盟', '纳采', '问名'], good: ['订婚', '订盟', '纳采', '嫁娶'], avoid: ['破土', '安葬', '词讼'] },
  装修: { terms: ['修造', '动土', '拆卸', '上梁'], good: ['修造', '动土', '拆卸', '上梁'], avoid: ['安葬', '破土', '词讼'] },
  祭祀: { terms: ['祭祀', '祈福', '斋醮', '焚香'], good: ['祭祀', '祈福', '斋醮', '焚香'], avoid: ['嫁娶', '动土', '破土'] },
  求学: { terms: ['入学', '习艺', '会亲友'], good: ['入学', '习艺', '求嗣', '会亲友'], avoid: ['安葬', '破土', '词讼'] },
  签约: { terms: ['立券', '交易', '纳财', '开市'], good: ['立券', '交易', '纳财', '开市'], avoid: ['动土', '安葬', '词讼'] },
  购车: { terms: ['买车', '置产', '纳财'], good: ['买车', '置产', '纳财', '交易'], avoid: ['破土', '安葬', '动土'] },
  求医: { terms: ['求医', '治病', '针灸', '沐浴'], good: ['求医', '治病', '针灸', '沐浴'], avoid: ['出行', '嫁娶', '安葬'] }
};
const hourNames = { 子: '23:00–00:59', 丑: '01:00–02:59', 寅: '03:00–04:59', 卯: '05:00–06:59', 辰: '07:00–08:59', 巳: '09:00–10:59', 午: '11:00–12:59', 未: '13:00–14:59', 申: '15:00–16:59', 酉: '17:00–18:59', 戌: '19:00–20:59', 亥: '21:00–22:59' };
const zodiacNames = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];

const form = document.querySelector('#pickerForm');
const eventButtons = [...document.querySelectorAll('.event-option')];
const resultGrid = document.querySelector('#resultGrid');
const resultEvent = document.querySelector('#resultEvent');
const resultMeta = document.querySelector('#resultMeta');
const railDays = document.querySelector('#railDays');
const toast = document.querySelector('#toast');
const startInput = document.querySelector('#startDate');
const endInput = document.querySelector('#endDate');
const citySelect = document.querySelector('#city');
const zodiacInputs = [...document.querySelectorAll('input[name="familyZodiac"]')];
const familySummary = document.querySelector('#familyZodiacSummary');
const clearFamilyButton = document.querySelector('#clearZodiacs');
let currentEvent = '婚嫁';
let currentCity = '上海 · 中国';
let avoidZodiacs = [];
let currentResults = [];
let savedDates = new Set();
const storageCache = Object.create(null);
let nativeStorage = null;

function renderCities() {
  if (!citySelect || !Array.isArray(window.cityGroups)) return;
  const options = window.cityGroups.map((group) => `<optgroup label="${escapeHtml(group.label)}">${group.cities.map((city) => `<option>${escapeHtml(city)} · 中国</option>`).join('')}</optgroup>`).join('');
  citySelect.innerHTML = options;
  const savedCity = readStorage('liangchen:city', '上海 · 中国');
  const nextCity = [...citySelect.options].some((option) => option.value === savedCity) ? savedCity : '上海 · 中国';
  citySelect.value = nextCity;
  currentCity = nextCity;
}

function selectedFamilyZodiacs() {
  return zodiacInputs.filter((input) => input.checked).map((input) => input.value);
}
function updateFamilySelection() {
  const selected = selectedFamilyZodiacs();
  familySummary.textContent = selected.length ? `已选 ${selected.length} 个生肖：${selected.join('、')}` : '未选择生肖，不限制冲煞';
  clearFamilyButton.disabled = selected.length === 0;
  writeStorage('liangchen:familyZodiacs', selected);
}
function restoreFamilySelection() {
  const saved = readStorage('liangchen:familyZodiacs', []);
  const selected = new Set(Array.isArray(saved) ? saved.filter((name) => zodiacNames.includes(name)) : []);
  zodiacInputs.forEach((input) => { input.checked = selected.has(input.value); });
  avoidZodiacs = selectedFamilyZodiacs();
  updateFamilySelection();
}

async function initializeStorage() {
  const sdk = window.xhs && window.xhs.miniTool;
  let options = window.xhs && window.xhs.launchOptions;
  if (!(options && options.miniToolEnv && options.miniToolEnv.buildVersion) && sdk && typeof sdk.getLaunchOptions === 'function') {
    try { options = await sdk.getLaunchOptions(); } catch (error) { options = null; }
  }
  const version = Math.floor(Number(options && options.miniToolEnv && options.miniToolEnv.buildVersion || 0) / 1000);
  if (version >= 9460 && sdk && typeof sdk.getStorage === 'function' && typeof sdk.setStorage === 'function') nativeStorage = sdk;
  for (const key of ['liangchen:saved', 'liangchen:city', 'liangchen:familyZodiacs']) {
    try {
      if (nativeStorage) {
        const result = await nativeStorage.getStorage({ key });
        storageCache[key] = result && result.data ? JSON.parse(result.data) : null;
        if (storageCache[key] == null) {
          try {
            const legacy = localStorage.getItem(key);
            if (legacy) { storageCache[key] = JSON.parse(legacy); await nativeStorage.setStorage({ key, data: legacy }); }
          } catch (error) { /* 原有浏览器缓存不可用时跳过迁移 */ }
        }
      } else storageCache[key] = JSON.parse(localStorage.getItem(key));
    } catch (error) { storageCache[key] = null; }
  }
}
function readStorage(key, fallback) { return storageCache[key] == null ? fallback : storageCache[key]; }
async function writeStorage(key, value) {
  storageCache[key] = value;
  try {
    const data = JSON.stringify(value);
    if (nativeStorage) await nativeStorage.setStorage({ key, data });
    else localStorage.setItem(key, data);
    return true;
  } catch (error) { showToast('本次选择仅在当前页面保留，未能保存到本地'); return false; }
}
function parseDate(value) { const date = new Date(`${value}T00:00:00`); return Number.isNaN(date.getTime()) ? null : date; }
function localDateValue(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function formatRange(start, end) { const a = parseDate(start), b = parseDate(end); return `${String(a.getMonth() + 1).padStart(2, '0')}.${String(a.getDate()).padStart(2, '0')} – ${String(b.getMonth() + 1).padStart(2, '0')}.${String(b.getDate()).padStart(2, '0')}`; }
function arrayValue(value) { return Array.isArray(value) ? value : String(value || '').split(',').filter(Boolean); }
function joinItems(values, fallback = '无') { const list = arrayValue(values); return list.length ? list.join('、') : fallback; }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char])); }
function formatLunar(lunar) { const month = lunar.getMonthInChinese(); return `农历${lunar.isLeapMonth && lunar.isLeapMonth() ? '闰' : ''}${month}月${lunar.getDayInChinese()}`; }
function formatSolar(date) { return `${date.getMonth() + 1} 月 / ${['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'][date.getMonth()]}`; }
function weekday(date) { return `星期${'日一二三四五六'[date.getDay()]}`; }
function scoreDay(lunar, config) {
  const yi = arrayValue(lunar.getDayYi(2)); const ji = arrayValue(lunar.getDayJi(2));
  const match = config.terms.filter((term) => yi.some((item) => item.includes(term) || term.includes(item))).length;
  const conflicts = config.avoid.filter((term) => ji.includes(term)).length;
  let score = 55 + match * 12 - conflicts * 7;
  if (lunar.getDayTianShenLuck() === '吉') score += 9;
  if (lunar.getDayTianShenLuck() === '凶') score -= 8;
  if (yi.includes('无')) score -= 4;
  return Math.max(45, Math.min(99, score));
}
function makeCandidate(date) {
  const lunar = Solar.fromYmd(date.getFullYear(), date.getMonth() + 1, date.getDate()).getLunar();
  const config = eventConfig[currentEvent];
  const yi = arrayValue(lunar.getDayYi(2)); const ji = arrayValue(lunar.getDayJi(2));
  const score = scoreDay(lunar, config);
  const hours = lunar.getTimes().slice(0, 12).map((time) => ({ branch: time.getZhi(), time: hourNames[time.getZhi()] || '', luck: time.getTianShenLuck(), tianShen: time.getTianShen(), yi: arrayValue(time.getYi()), ji: arrayValue(time.getJi()) })).filter((item) => item.luck === '吉').sort((a, b) => (b.yi.some((x) => config.terms.some((term) => x.includes(term))) ? 1 : 0) - (a.yi.some((x) => config.terms.some((term) => x.includes(term))) ? 1 : 0)).slice(0, 3);
  return { date: localDateValue(date), dateObject: date, lunarText: formatLunar(lunar), week: weekday(date), score, yi, ji, chongZodiac: lunar.getDayChongShengXiao(), zodiac: `冲${lunar.getDayChongShengXiao()} · 煞${lunar.getDaySha()}`, tianShen: `${lunar.getDayTianShen()} · ${lunar.getDayTianShenLuck()}`, jiShen: arrayValue(lunar.getDayJiShen()), xiongSha: arrayValue(lunar.getDayXiongSha()), ganZhi: lunar.getDayInGanZhi(), xi: lunar.getDayPositionXiDesc(), fu: lunar.getDayPositionFuDesc(), cai: lunar.getDayPositionCaiDesc(), hours, config };
}
async function getCandidates(start, end) {
  const a = parseDate(start), b = parseDate(end); const items = [];
  if (!a || !b || a > b) return items;
  const maxDays = 366; const cursor = new Date(a);
  while (cursor <= b && items.length <= maxDays) { items.push(makeCandidate(new Date(cursor))); cursor.setDate(cursor.getDate() + 1); if (items.length % 10 === 0) await new Promise(resolve => setTimeout(resolve, 0)); }
  return items.filter((item) => !avoidZodiacs.includes(item.chongZodiac)).sort((aItem, bItem) => bItem.score - aItem.score || aItem.date.localeCompare(bItem.date));
}
function tagFor(score) { return score >= 88 ? '上上吉' : score >= 75 ? '宜成事' : score >= 62 ? '可考虑' : '平稳日'; }
function renderRail(start, end, recommendations) {
  const a = parseDate(start), b = parseDate(end); if (!a || !b) return;
  const days = []; const cursor = new Date(a); const total = Math.max(1, Math.floor((b - a) / 86400000)); const step = Math.max(1, Math.ceil(total / 6));
  while (cursor <= b && days.length < 7) { days.push(new Date(cursor)); cursor.setDate(cursor.getDate() + step); }
  while (days.length < 7) { const next = new Date(days[days.length - 1] || a); next.setDate(next.getDate() + 1); days.push(next); }
  const bestDates = new Set(recommendations.map((item) => item.date));
  railDays.innerHTML = days.map((day) => { const key = localDateValue(day); const hit = bestDates.has(key); return `<div class="rail-day ${hit ? 'is-picked' : ''}" title="${hit ? '推荐吉日' : '此日期已计算'}"><strong>${String(day.getDate()).padStart(2, '0')}</strong><span>${'日一二三四五六'[day.getDay()]}</span><em>${hit ? '吉' : ''}</em></div>`; }).join('');
}
function cardHtml(item, index) {
  const date = item.dateObject; const good = item.yi.length && !item.yi.includes('无') ? item.yi.slice(0, 5).join('、') : '暂无特别宜项'; const avoid = item.ji.length && !item.ji.includes('无') ? item.ji.slice(0, 5).join('、') : '暂无特别忌项';
  return `<article class="result-card ${index === 0 ? 'featured' : ''}" data-date="${item.date}">${index === 0 ? `<div class="card-tag">${tagFor(item.score)}</div>` : ''}<button class="result-open" data-open-date="${item.date}" aria-label="查看 ${item.date} 详情"><div class="result-top"><div class="result-date"><span class="month">${formatSolar(date)}</span><strong>${String(date.getDate()).padStart(2, '0')}</strong><small>${escapeHtml(item.week)} · ${escapeHtml(item.lunarText)}</small></div><div class="score"><strong>${item.score}</strong><small>吉日指数</small></div></div><div class="result-divider"></div><div class="detail-row"><span>宜</span><span class="auspicious">${escapeHtml(good)}</span></div><div class="detail-row"><span>忌</span><span class="taboo">${escapeHtml(avoid)}</span></div><div class="detail-row"><span>冲</span><span>${escapeHtml(item.zodiac)}</span></div></button><div class="result-bottom"><div class="time-chips">${item.hours.slice(0, 2).map((hour) => `<span class="time-chip">${escapeHtml(hour.branch)}时</span>`).join('') || '<span class="time-chip">暂无吉时</span>'}</div><button class="favorite ${savedDates.has(item.date) ? 'saved' : ''}" data-date="${item.date}" aria-label="${savedDates.has(item.date) ? '取消收藏' : '收藏'} ${item.date}">${savedDates.has(item.date) ? '♥' : '♡'}</button></div></article>`;
}
async function renderResults(start = startInput.value, end = endInput.value) {
  currentResults = await getCandidates(start, end);
  const recommendations = currentResults.slice(0, 3);
  resultEvent.textContent = currentEvent;
  const familyNote = avoidZodiacs.length ? ` · 全家生肖：${avoidZodiacs.join('、')} · 已排除与任一已选生肖相冲的日期` : '';
  resultMeta.textContent = `在 ${formatRange(start, end)} 之间，${avoidZodiacs.length ? '筛选后剩余' : '共计算'} ${currentResults.length} 天，为你推荐 ${recommendations.length} 个选择 · ${currentCity}${familyNote}`;
  const emptyTitle = avoidZodiacs.length ? '这段时间没有同时避开全家生肖的日期' : '这个范围暂时没有可展示的日期';
  const emptyHint = avoidZodiacs.length === zodiacNames.length ? '已选全部 12 个生肖，每天都会与其中一个相冲。请减少参与择日的生肖后重试。' : '请扩大日期范围，或调整参与择日的生肖后重试。';
  resultGrid.innerHTML = recommendations.length ? recommendations.map(cardHtml).join('') : `<div class="empty-result"><strong>${emptyTitle}</strong><span>${emptyHint}</span></div>`;
  renderRail(start, end, recommendations); bindFavorites(); bindDetails();
  updateToday();
}
function bindFavorites() { resultGrid.querySelectorAll('.favorite').forEach((button) => button.addEventListener('click', (event) => { event.stopPropagation(); const date = button.dataset.date; if (savedDates.has(date)) { savedDates.delete(date); showToast('已取消收藏'); } else { savedDates.add(date); showToast('已收藏这一天'); } writeStorage('liangchen:saved', [...savedDates]); resultGrid.innerHTML = currentResults.slice(0, 3).map(cardHtml).join(''); bindFavorites(); bindDetails(); })); }
function bindDetails() { resultGrid.querySelectorAll('[data-open-date]').forEach((button) => button.addEventListener('click', () => openDetail(button.dataset.openDate))); }
function openDetail(date) { const item = currentResults.find((entry) => entry.date === date); if (!item) return; const hours = item.hours.map((hour) => `<div class="hour-row"><span>${hour.branch}时</span><strong>${hour.time}</strong><em class="${hour.luck === '吉' ? 'auspicious' : 'taboo'}">${hour.tianShen} · ${hour.luck}</em></div>`).join(''); showToast(`${item.date} · ${item.ganZhi} · 喜神在${item.xi}`); document.querySelector('#detailPanel')?.remove(); const panel = document.createElement('aside'); panel.id = 'detailPanel'; panel.className = 'detail-panel'; panel.innerHTML = `<div class="detail-panel-inner"><button class="detail-close" aria-label="关闭详情">×</button><span class="detail-kicker">${escapeHtml(resultEvent.textContent)} · ${escapeHtml(item.date)}</span><h3>${item.dateObject.getMonth() + 1} 月 ${item.dateObject.getDate()} 日 <em>${escapeHtml(item.week)}</em></h3><p class="detail-lunar">${escapeHtml(item.lunarText)} · ${escapeHtml(item.ganZhi)}日 · ${escapeHtml(item.tianShen)}</p><div class="detail-score"><strong>${item.score}</strong><span>吉日指数</span></div><div class="detail-columns"><div><span>宜</span><p class="auspicious">${escapeHtml(joinItems(item.yi))}</p></div><div><span>忌</span><p class="taboo">${escapeHtml(joinItems(item.ji))}</p></div></div><div class="detail-facts">${avoidZodiacs.length ? `<p>全家生肖：${escapeHtml(avoidZodiacs.join('、'))} · 当日均不相冲</p>` : ''}<p>冲煞：${escapeHtml(item.zodiac)}</p><p>吉神：${escapeHtml(joinItems(item.jiShen))}</p><p>方位：喜神 ${escapeHtml(item.xi)} · 福神 ${escapeHtml(item.fu)} · 财神 ${escapeHtml(item.cai)}</p></div><h4>可选吉时</h4><div class="hour-grid">${hours || '<span>当天没有标记为吉的时辰</span>'}</div><small class="detail-disclaimer">计算基于传统历法，仅作为日程参考。</small></div>`; document.body.appendChild(panel); panel.querySelector('.detail-close').addEventListener('click', () => panel.remove()); panel.addEventListener('click', (event) => { if (event.target === panel) panel.remove(); }); }
function updateToday() { const now = new Date(); const today = makeCandidate(now); const lunar = Solar.fromYmd(now.getFullYear(), now.getMonth() + 1, now.getDate()).getLunar(); const lunarText = document.querySelector('.today-item strong'); const dateStrong = document.querySelector('.today-date strong'); const dateWeek = document.querySelector('.today-date > span:last-child'); if (dateStrong) dateStrong.textContent = `${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`; if (dateWeek) dateWeek.textContent = today.week; if (lunarText) lunarText.textContent = `${today.lunarText.replace('农历', '')} · ${today.ganZhi}日`; const todayItemSmall = document.querySelectorAll('.today-item small'); if (todayItemSmall[0]) todayItemSmall[0].textContent = `${lunar.getNextJieQi()?.getName?.() || '节气流转中'} · ${today.tianShen}`; if (todayItemSmall[1] && today.hours[0]) todayItemSmall[1].textContent = `${today.hours[0].branch}时 · ${today.hours[0].tianShen}`; if (todayItemSmall[2]) todayItemSmall[2].textContent = `财神 · ${today.cai}`; const advice = document.querySelector('.calendar-advice div strong'); if (advice) advice.textContent = today.yi.slice(0, 3).join(' · ') || '诸事随缘'; const avoid = document.querySelector('.calendar-advice div:nth-child(2) strong'); if (avoid) avoid.textContent = today.ji.slice(0, 2).join(' · ') || '暂无特别忌项'; const set = (id, value) => { const node = document.querySelector(id); if (node) node.textContent = value; }; set('#todayDay', String(now.getDate()).padStart(2, '0')); set('#todayWeek', `${today.week} · ${lunar.getNextJieQi()?.getName?.() || '节气流转中'}`); set('#todayYearGanZhi', `${lunar.getYearInGanZhi()}年`); set('#todayLunarText', today.lunarText.replace('农历', '')); set('#todayGanZhi', `${today.ganZhi}日`); set('#todayJiShen', `今日吉神 · ${today.jiShen.slice(0, 2).join(' · ') || '平安'}`); set('#todayLuckSeal', today.tianShen.endsWith('吉') ? '吉' : '平'); }
function showToast(message) { toast.textContent = message; toast.classList.add('show'); clearTimeout(showToast.timer); showToast.timer = setTimeout(() => toast.classList.remove('show'), 2400); }

eventButtons.forEach((button) => button.addEventListener('click', () => { currentEvent = button.dataset.event; eventButtons.forEach((item) => { const active = item === button; item.classList.toggle('selected', active); item.setAttribute('aria-pressed', String(active)); }); }));
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const start = startInput.value; const end = endInput.value;
  if (!parseDate(start) || !parseDate(end)) return showToast('请先选择开始和结束日期');
  if (parseDate(start) > parseDate(end)) return showToast('结束日期需要晚于开始日期');
  if ((parseDate(end) - parseDate(start)) / 86400000 > 366) return showToast('一次最多计算 366 天');
  currentCity = citySelect?.value || currentCity;
  avoidZodiacs = selectedFamilyZodiacs();
  document.querySelector('#detailPanel')?.remove();
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true;
  try { await renderResults(start, end); } catch (error) { showToast('计算失败，请调整日期后重试'); return; } finally { submit.disabled = false; }
  document.querySelector('#results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  showToast(currentResults.length ? `已${avoidZodiacs.length ? '避开全家生肖相冲日期，' : '按真实历法'}排出 ${currentEvent} 吉日` : '没有符合条件的日期，请调整筛选条件');
});
citySelect?.addEventListener('change', (event) => { currentCity = event.target.value; writeStorage('liangchen:city', currentCity); });
zodiacInputs.forEach((input) => input.addEventListener('change', updateFamilySelection));
clearFamilyButton.addEventListener('click', () => {
  zodiacInputs.forEach((input) => { input.checked = false; });
  updateFamilySelection();
});
document.querySelector('#changeSearch').addEventListener('click', () => document.querySelector('#picker').scrollIntoView({ behavior: 'smooth', block: 'start' }));
document.querySelector('#headerSave').addEventListener('click', () => showToast(savedDates.size ? `已收藏 ${savedDates.size} 个日期` : '先收藏一个你喜欢的日子吧'));
document.querySelectorAll('.note-link').forEach((link) => link.addEventListener('click', (event) => { event.preventDefault(); showToast('择日小笺正在持续补充'); }));
async function startApp() {
  await initializeStorage();
  const saved = readStorage('liangchen:saved', []);
  savedDates = new Set(Array.isArray(saved) ? saved.filter(value => typeof value === 'string') : []);
const todayValue = localDateValue(new Date());
renderCities();
restoreFamilySelection();
const eyebrow = document.querySelector('.eyebrow'); if (eyebrow) eyebrow.innerHTML = `<span class="eyebrow-dot"></span> ${new Date().getFullYear()} · 本地历法 · 今日可查`;  if (!startInput.value || startInput.value === '2026-10-04') startInput.value = todayValue; if (!endInput.value || endInput.value === '2026-10-24') { const end = new Date(); end.setDate(end.getDate() + 30); endInput.value = localDateValue(end); } await renderResults();

}
startApp().catch(() => showToast('页面初始化失败，请重新打开后重试'));
