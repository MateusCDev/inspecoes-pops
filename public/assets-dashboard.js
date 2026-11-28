'use strict';

const ASSET_DASH_STATUS_META = {
  Operacional: { key: 'Operacional', pill: 'ad-pill-ok', color: '#1c8f55' },
  'Atenção': { key: 'Atenção', pill: 'ad-pill-warn', color: '#e0911f' },
  'Crítico': { key: 'Crítico', pill: 'ad-pill-crit', color: '#c51c33' },
  Inativo: { key: 'Inativo', pill: 'ad-pill-inact', color: '#8391a5' },
  'Sem status': { key: 'Sem status', pill: 'ad-pill-inact', color: '#b4bfce' }
};

let assetDashState = {
  loading: false,
  loaded: false,
  error: '',
  data: null,
  tab: 'assets',
  search: '',
  station: '',
  category: '',
  status: '',
  maker: '',
  staleOnly: false,
  infraAlertsOnly: false,
  qualityFilter: '',
  sortBy: 'station',
  sortDir: 'asc',
  pageSize: 50
};
let assetDashSearchTimer = null;

function adNorm(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
}

function adNormalizeStatus(raw) {
  const n = adNorm(raw);
  if (!n) return 'Sem status';
  if (n.includes('CRITIC') || n.includes('SUBSTITU') || n.includes('FALHA') || n.includes('VENCID') || n.includes('ALARM')) return 'Crítico';
  if (n.includes('ATENC') || n.includes('OBSERV') || n.includes('ALERTA') || n.includes('PROXIMO')) return 'Atenção';
  if (n.includes('INATIV') || n.includes('RETIRAD') || n.includes('DESATIV')) return 'Inativo';
  if (n.includes('OPERAC') || n === 'OK' || n.includes('NORMAL') || n.includes('EM DIA')) return 'Operacional';
  return String(raw).trim();
}

function adParseDateMs(value) {
  if (!value) return null;
  const s = String(value).trim();
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return Date.UTC(Number(br[3]), Number(br[2]) - 1, Number(br[1]));
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  return null;
}

function adParseNum(value) {
  if (value === null || value === undefined || value === '') return null;
  const cleaned = String(value).replace(/[^\d,.-]/g, '').replace(',', '.');
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function adIsStale(dateStr, nowMs = Date.now()) {
  const ms = adParseDateMs(dateStr);
  if (ms === null) return true;
  return (nowMs - ms) > 90 * 86400000;
}

function adBatteryHasAlert(b) {
  const st = adNormalizeStatus(b.status);
  if (st === 'Crítico' || st === 'Atenção') return true;
  const age = adParseNum(b.ageMonths);
  const isLithium = /LITIO|LIFEPO4/i.test(adNorm(b.tech));
  if (age !== null && age >= (isLithium ? 96 : 36)) return true;
  const autonomy = adParseNum(b.autonomy);
  if (autonomy !== null && autonomy > 0 && autonomy < 4) return true;
  return false;
}

function adRectifierHasAlert(r, nowMs = Date.now()) {
  const st = adNormalizeStatus(r.status);
  if (st === 'Crítico' || st === 'Atenção') return true;
  const nextMs = adParseDateMs(r.nextCheck);
  if (nextMs !== null && nextMs < nowMs) return true;
  const urs = [r.ur01, r.ur02, r.ur03, r.ur04].map(adNorm);
  if (urs.some(u => u && (u.includes('FALHA') || u.includes('DEFEITO') || u.includes('ALARM') || u.includes('CRITIC')))) return true;
  return false;
}

function adClimateHasAlert(c, nowMs = Date.now()) {
  const st = adNormalizeStatus(c.status);
  if (st === 'Crítico' || st === 'Atenção') return true;
  const temp = adParseNum(c.tempC);
  if (temp !== null && temp > 26) return true;
  const nextMs = adParseDateMs(c.nextMaint);
  if (nextMs !== null && nextMs < nowMs) return true;
  return false;
}

function computeAssetDashboardMetrics(data, filters = {}, nowMs = Date.now()) {
  const rawAssets = data?.assets || [];
  const rawBatteries = data?.batteries || [];
  const rawRectifiers = data?.rectifiers || [];
  const rawClimate = data?.climate || [];
  const rawEvents = data?.recentEvents || [];

  const q = adNorm(filters.search || '');
  const matchSearch = parts => !q || adNorm(parts.filter(Boolean).join(' ')).includes(q);
  const validIdToken = v => {
    const n = adNorm(v);
    return Boolean(n && !/^(N\/?A|SEM SERIE|SEM PATRIMONIO|NAO IDENTIFICAD[OA]|-+)$/.test(n));
  };

  // Detect duplicate serials across the full inventory for governance
  const serialFreq = new Map();
  for (const item of rawAssets) {
    if (validIdToken(item.serial)) {
      const key = adNorm(item.serial);
      serialFreq.set(key, (serialFreq.get(key) || 0) + 1);
    }
  }
  const duplicateSerials = new Set([...serialFreq.entries()].filter(([, n]) => n > 1).map(([k]) => k));

  const normalizedAssets = rawAssets.map((item, idx) => {
    const statusNorm = adNormalizeStatus(item.status);
    const stale = adIsStale(item.lastInspection, nowMs);
    const hasSerial = validIdToken(item.serial);
    const hasTag = validIdToken(item.assetTag);
    const duplicateSerial = hasSerial && duplicateSerials.has(adNorm(item.serial));
    return { ...item, _idx: idx, statusNorm, stale, hasSerial, hasTag, duplicateSerial };
  });

  // Base scope for cross-filtering charts (respects search, station, category, maker, staleOnly)
  const matchesCommon = item => {
    if (filters.station && item.station !== filters.station) return false;
    if (filters.category && item.category !== filters.category) return false;
    if (filters.maker && item.maker !== filters.maker) return false;
    if (filters.staleOnly && !item.stale) return false;
    return matchSearch([item.station, item.stationCode, item.category, item.equipment, item.maker, item.model, item.serial, item.assetTag, item.note]);
  };

  const baseAssets = normalizedAssets.filter(matchesCommon);
  const filteredAssets = baseAssets.filter(item => {
    if (filters.status && item.statusNorm !== filters.status) return false;
    if (filters.qualityFilter === 'missingId' && (item.hasSerial || item.hasTag)) return false;
    if (filters.qualityFilter === 'duplicateSerial' && !item.duplicateSerial) return false;
    if (filters.qualityFilter === 'unrated' && item.statusNorm !== 'Sem status') return false;
    return true;
  });

  const filterAux = (list, fieldsFn) => list.filter(item => {
    if (filters.station && item.station !== filters.station) return false;
    if (filters.maker && item.maker !== filters.maker) return false;
    return matchSearch(fieldsFn(item));
  });

  const batteries = filterAux(rawBatteries, b => [b.station, b.stationCode, b.name, b.tech, b.maker, b.model, b.assetTag, b.note])
    .map(b => ({ ...b, statusNorm: adNormalizeStatus(b.status), alert: adBatteryHasAlert(b) }));
  const rectifiers = filterAux(rawRectifiers, r => [r.station, r.stationCode, r.maker, r.model, r.serial, r.assetTag, r.note])
    .map(r => ({ ...r, statusNorm: adNormalizeStatus(r.status), alert: adRectifierHasAlert(r, nowMs) }));
  const climate = filterAux(rawClimate, c => [c.station, c.stationCode, c.maker, c.model, c.serial, c.assetTag, c.gas, c.note])
    .map(c => ({ ...c, statusNorm: adNormalizeStatus(c.status), alert: adClimateHasAlert(c, nowMs) }));

  const statusCounts = { Operacional: 0, 'Atenção': 0, 'Crítico': 0, Inativo: 0, 'Sem status': 0 };
  const byCategory = new Map();
  const byStation = new Map();
  let staleCount = 0;
  let missingSerial = 0, missingAssetTag = 0, missingBoth = 0, duplicateSerialCount = 0, wellDocumented = 0;

  const ensureStation = (name, code = '') => {
    const key = name || 'Sem POP';
    if (!byStation.has(key)) {
      byStation.set(key, {
        station: key, stationCode: code, total: 0, crit: 0, warn: 0, ok: 0,
        batteries: 0, rectifiers: 0, climate: 0, alerts: 0, lastInspection: '', lastMs: 0
      });
    }
    const entry = byStation.get(key);
    if (code && !entry.stationCode) entry.stationCode = code;
    return entry;
  };

  for (const item of baseAssets) {
    statusCounts[item.statusNorm] = (statusCounts[item.statusNorm] || 0) + 1;
    if (item.stale) staleCount++;
    if (!item.hasSerial) missingSerial++;
    if (!item.hasTag) missingAssetTag++;
    if (!item.hasSerial && !item.hasTag) missingBoth++;
    if (item.duplicateSerial) duplicateSerialCount++;
    if ((item.hasSerial || item.hasTag) && item.statusNorm !== 'Sem status') wellDocumented++;
    byCategory.set(item.category, (byCategory.get(item.category) || 0) + 1);
    const st = ensureStation(item.station, item.stationCode);
    st.total++;
    if (item.statusNorm === 'Crítico') st.crit++;
    else if (item.statusNorm === 'Atenção') st.warn++;
    else if (item.statusNorm === 'Operacional') st.ok++;
    const ms = adParseDateMs(item.lastInspection);
    if (ms && ms > st.lastMs) { st.lastMs = ms; st.lastInspection = item.lastInspection; }
  }
  for (const b of batteries) {
    const st = ensureStation(b.station, b.stationCode);
    st.batteries++;
    if (b.alert) st.alerts++;
  }
  for (const r of rectifiers) {
    const st = ensureStation(r.station, r.stationCode);
    st.rectifiers++;
    if (r.alert) st.alerts++;
  }
  for (const c of climate) {
    const st = ensureStation(c.station, c.stationCode);
    st.climate++;
    if (c.alert) st.alerts++;
  }

  const totalBase = baseAssets.length;
  const rated = statusCounts.Operacional + statusCounts['Atenção'] + statusCounts['Crítico'];
  const healthPct = rated > 0 ? Math.round((statusCounts.Operacional / rated) * 100) : 0;
  const quality = {
    missingSerial,
    missingAssetTag,
    missingBoth,
    duplicateSerialCount,
    unratedCount: statusCounts['Sem status'] || 0,
    qualityPct: totalBase > 0 ? Math.round((wellDocumented / totalBase) * 100) : 100
  };

  const popMatrix = [...byStation.values()]
    .map(st => {
      const stRated = st.ok + st.warn + st.crit;
      return { ...st, healthPct: stRated > 0 ? Math.round((st.ok / stRated) * 100) : null };
    })
    .sort((a, b) => (b.crit * 4 + b.warn * 2 + b.alerts * 2) - (a.crit * 4 + a.warn * 2 + a.alerts * 2) || b.total - a.total || a.station.localeCompare(b.station, 'pt-BR'));

  const popRanking = popMatrix.filter(st => st.total > 0).slice(0, 10);

  const categoryRanking = [...byCategory.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category, 'pt-BR'))
    .slice(0, 10);

  const batteryAlerts = batteries.filter(b => b.alert).length;
  const rectifierAlerts = rectifiers.filter(r => r.alert).length;
  const climateAlerts = climate.filter(c => c.alert).length;
  const infraAlertCount = batteryAlerts + rectifierAlerts + climateAlerts;

  const batteryTech = { litio: 0, vrla: 0, other: 0 };
  for (const b of batteries) {
    const n = adNorm(b.tech);
    if (n.includes('LITIO') || n.includes('LIFEPO4')) batteryTech.litio++;
    else if (n.includes('VRLA') || n.includes('CHUMBO')) batteryTech.vrla++;
    else batteryTech.other++;
  }

  // Facets from unfiltered dataset so user can always switch freely
  const uniq = arr => [...new Set(arr.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const facets = {
    stations: uniq([...rawAssets.map(x => x.station), ...rawBatteries.map(x => x.station), ...rawRectifiers.map(x => x.station), ...rawClimate.map(x => x.station)]),
    categories: uniq(rawAssets.map(x => x.category)),
    makers: uniq([...rawAssets.map(x => x.maker), ...rawBatteries.map(x => x.maker), ...rawRectifiers.map(x => x.maker), ...rawClimate.map(x => x.maker)])
  };

  const events = rawEvents.filter(e => {
    if (filters.station) {
      const code = rawAssets.find(a => a.station === filters.station)?.stationCode;
      if (code && e.stationCode && e.stationCode !== code) return false;
    }
    return matchSearch([e.stationCode, e.tab, e.action, e.detail, e.inspectionId, e.assetId]);
  });

  return {
    totalBase,
    filteredAssets,
    batteries,
    rectifiers,
    climate,
    events,
    statusCounts,
    healthPct,
    staleCount,
    stationCount: byStation.size,
    popMatrix,
    popRanking,
    categoryRanking,
    quality,
    batteryAlerts,
    rectifierAlerts,
    climateAlerts,
    infraAlertCount,
    batteryTech,
    facets
  };
}

function adPill(statusNorm) {
  const meta = ASSET_DASH_STATUS_META[statusNorm] || ASSET_DASH_STATUS_META['Sem status'];
  return `<span class="ad-pill ${meta.pill}">${esc(statusNorm)}</span>`;
}

function adRenderDonut(statusCounts, totalBase, healthPct, activeStatus) {
  const order = ['Operacional', 'Atenção', 'Crítico', 'Inativo', 'Sem status'];
  const radius = 56, circ = 2 * Math.PI * radius;
  let offset = 0;
  const segments = totalBase > 0 ? order.map(key => {
    const count = statusCounts[key] || 0;
    if (!count) return '';
    const frac = count / totalBase;
    const len = frac * circ;
    const strokeDasharray = `${len.toFixed(2)} ${(circ - len).toFixed(2)}`;
    const seg = `<circle class="ad-donut-seg" cx="75" cy="75" r="${radius}" fill="none"
      stroke="${ASSET_DASH_STATUS_META[key].color}" stroke-width="${activeStatus === key ? 22 : 18}"
      stroke-dasharray="${strokeDasharray}" stroke-dashoffset="${(-offset).toFixed(2)}"
      transform="rotate(-90 75 75)" data-ad-filter-status="${esc(key)}">
      <title>${esc(key)}: ${count} (${Math.round(frac * 100)}%)</title></circle>`;
    offset += len;
    return seg;
  }).join('') : `<circle cx="75" cy="75" r="${radius}" fill="none" stroke="#e4ebf3" stroke-width="18"></circle>`;

  const legend = order.filter(k => (statusCounts[k] || 0) > 0 || k === 'Operacional' || k === 'Crítico').map(key => {
    const count = statusCounts[key] || 0;
    const pct = totalBase > 0 ? Math.round((count / totalBase) * 100) : 0;
    return `<li><button type="button" class="${activeStatus === key ? 'is-active' : ''}" data-ad-filter-status="${esc(key)}">
      <span><span class="ad-dot" style="background:${ASSET_DASH_STATUS_META[key].color}"></span>${esc(key)}</span>
      <strong>${count} <span class="small muted">(${pct}%)</span></strong>
    </button></li>`;
  }).join('');

  return `<div class="ad-donut-wrap">
    <svg class="ad-donut-svg" viewBox="0 0 150 150" role="img" aria-label="Distribuição de ativos por status">
      ${segments}
      <text x="75" y="71" text-anchor="middle" font-size="24" font-weight="800" fill="#192332">${totalBase ? healthPct + '%' : '—'}</text>
      <text x="75" y="89" text-anchor="middle" font-size="11" font-weight="650" fill="#566478">operacional</text>
    </svg>
    <ul class="ad-legend">${legend}</ul>
  </div>`;
}

function adRenderPopRanking(ranking, activeStation) {
  if (!ranking.length) return '<p class="small muted">Nenhum POP encontrado com os filtros atuais.</p>';
  const maxTotal = Math.max(1, ...ranking.map(r => r.total));
  return `<div class="ad-bars">${ranking.map(r => {
    const critW = (r.crit / maxTotal) * 100;
    const warnW = (r.warn / maxTotal) * 100;
    const okW = (r.ok / maxTotal) * 100;
    const badges = [
      r.crit ? `<strong style="color:#b9142a">${r.crit} crít.</strong>` : '',
      r.warn ? `<strong style="color:#9c5700">${r.warn} aten.</strong>` : '',
      `${r.total} total`
    ].filter(Boolean).join(' · ');
    return `<button type="button" class="ad-bar-row ${activeStation === r.station ? 'is-active' : ''}" data-ad-filter-station="${esc(r.station)}">
      <div class="ad-bar-meta"><span class="ad-bar-name">${esc(r.station)}</span><span class="ad-bar-count">${badges}</span></div>
      <div class="ad-bar-track">
        ${critW ? `<span class="ad-bar-fill ad-fill-crit" style="width:${critW.toFixed(1)}%"></span>` : ''}
        ${warnW ? `<span class="ad-bar-fill ad-fill-warn" style="width:${warnW.toFixed(1)}%"></span>` : ''}
        ${okW ? `<span class="ad-bar-fill ad-fill-ok" style="width:${okW.toFixed(1)}%"></span>` : ''}
      </div>
    </button>`;
  }).join('')}</div>`;
}

function adRenderCategoryBars(ranking, activeCategory) {
  if (!ranking.length) return '<p class="small muted">Nenhuma categoria para exibir.</p>';
  const max = Math.max(1, ranking[0].count);
  return `<div class="ad-bars">${ranking.map(r => {
    const w = (r.count / max) * 100;
    return `<button type="button" class="ad-bar-row ${activeCategory === r.category ? 'is-active' : ''}" data-ad-filter-category="${esc(r.category)}">
      <div class="ad-bar-meta"><span class="ad-bar-name">${esc(r.category)}</span><span class="ad-bar-count"><strong>${r.count}</strong></span></div>
      <div class="ad-bar-track"><span class="ad-bar-fill ad-fill-cat" style="width:${w.toFixed(1)}%"></span></div>
    </button>`;
  }).join('')}</div>`;
}

function adSortRows(rows, sortBy, sortDir) {
  const dir = sortDir === 'desc' ? -1 : 1;
  return [...rows].sort((a, b) => {
    if (sortBy === 'lastInspection') {
      return ((adParseDateMs(a.lastInspection) || 0) - (adParseDateMs(b.lastInspection) || 0)) * dir;
    }
    const left = String(a[sortBy] || ''), right = String(b[sortBy] || '');
    return left.localeCompare(right, 'pt-BR', { numeric: true, sensitivity: 'base' }) * dir;
  });
}

function adBuildCsv(tab, metrics) {
  const quote = value => {
    const s = String(value ?? '');
    const safe = /^[\s]*[=+\-@]/.test(s) ? "'" + s : s;
    return '"' + safe.replaceAll('"', '""') + '"';
  };
  let headers, rows;
  if (tab === 'pops') {
    headers = ['POP / Estação', 'Código POP', 'Total Ativos', 'Saúde (%)', 'Críticos', 'Atenção', 'Operacionais', 'Baterias', 'Retificadoras', 'Climatizadores', 'Alertas Infra', 'Última Inspeção'];
    rows = metrics.popMatrix.map(p => [p.station, p.stationCode, p.total, p.healthPct ?? '', p.crit, p.warn, p.ok, p.batteries, p.rectifiers, p.climate, p.alerts, p.lastInspection]);
  } else if (tab === 'batteries') {
    headers = ['Estação', 'Descrição', 'Tecnologia', 'Fabricante', 'Modelo', 'Qtd', 'Tensão (V)', 'Capacidade (Ah)', 'Autonomia (h)', 'Instalação', 'Tempo de uso (meses)', 'Status', 'Patrimônio', 'Observações'];
    rows = metrics.batteries.map(b => [b.station, b.name, b.tech, b.maker, b.model, b.qty, b.voltage, b.capacity, b.autonomy, b.installed, b.ageMonths, b.statusNorm, b.assetTag, b.note]);
  } else if (tab === 'rectifiers') {
    headers = ['Estação', 'Fabricante', 'Modelo', 'Módulos', 'Corrente CC (A)', 'Tensão (V)', 'UR 01', 'UR 02', 'UR 03', 'UR 04', 'Última verificação', 'Próxima verificação', 'Status', 'Nº Série', 'Patrimônio'];
    rows = metrics.rectifiers.map(r => [r.station, r.maker, r.model, r.modules, r.currentA, r.voltageV, r.ur01, r.ur02, r.ur03, r.ur04, r.lastCheck, r.nextCheck, r.statusNorm, r.serial, r.assetTag]);
  } else if (tab === 'climate') {
    headers = ['Estação', 'Fabricante', 'Modelo', 'BTUs', 'Tipo', 'Gás', 'Carga gás', 'Corrente (A)', 'Temperatura (°C)', 'Próxima manutenção', 'Status', 'Nº Série', 'Última inspeção'];
    rows = metrics.climate.map(c => [c.station, c.maker, c.model, c.btus, c.type, c.gas, c.gasCharge, c.currentA, c.tempC, c.nextMaint, c.statusNorm, c.serial, c.lastInspection]);
  } else {
    headers = ['POP / Local', 'Código POP', 'Categoria', 'Equipamento', 'Fabricante', 'Modelo', 'Nº Série', 'Patrimônio', 'Status', 'Última inspeção', 'ID Inspeção', 'Observações'];
    rows = metrics.filteredAssets.map(a => [a.station, a.stationCode, a.category, a.equipment, a.maker, a.model, a.serial, a.assetTag, a.statusNorm, a.lastInspection, a.inspectionId, a.note]);
  }
  return '\uFEFF' + [headers, ...rows].map(r => r.map(quote).join(';')).join('\r\n');
}

function adRenderTableSection(metrics) {
  const { tab, sortBy, sortDir, pageSize, infraAlertsOnly } = assetDashState;
  const sortHeader = (col, label) => {
    const arrow = sortBy === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';
    return `<th><button type="button" class="ad-sort" data-ad-sort="${col}">${label}${arrow}</button></th>`;
  };

  if (tab === 'pops') {
    if (!metrics.popMatrix.length) return '<div class="ad-empty">Nenhum POP encontrado com os filtros aplicados.</div>';
    return `<div class="ad-table-scroll"><table class="ad-table">
      <thead><tr><th>POP / Estação</th><th>Ativos</th><th>Saúde (%)</th><th>Críticos</th><th>Atenção</th><th>Bat. / Ret. / Clima</th><th>Alertas Infra</th><th>Últ. Inspeção</th></tr></thead>
      <tbody>${metrics.popMatrix.map(p => `<tr class="ad-clickable" data-ad-pop-jump="${esc(p.station)}" title="Clique para filtrar este POP">
        <td><strong>${esc(p.station)}</strong>${p.stationCode ? `<div class="small muted ad-mono">${esc(p.stationCode)}</div>` : ''}</td>
        <td><strong>${p.total}</strong></td>
        <td>${p.healthPct !== null ? `<div class="ad-health-mini"><strong>${p.healthPct}%</strong><div class="ad-bar-track"><span class="ad-bar-fill ${p.healthPct >= 85 ? 'ad-fill-ok' : p.healthPct >= 60 ? 'ad-fill-warn' : 'ad-fill-crit'}" style="width:${p.healthPct}%"></span></div></div>` : '—'}</td>
        <td>${p.crit ? `<span class="ad-pill ad-pill-crit">${p.crit}</span>` : '0'}</td>
        <td>${p.warn ? `<span class="ad-pill ad-pill-warn">${p.warn}</span>` : '0'}</td>
        <td class="small">${p.batteries} bat · ${p.rectifiers} ret · ${p.climate} clima</td>
        <td>${p.alerts ? `<span class="ad-pill ad-pill-warn">${p.alerts}</span>` : '<span class="ad-pill ad-pill-ok">0</span>'}</td>
        <td class="small">${esc(p.lastInspection || '—')}</td>
      </tr>`).join('')}</tbody></table></div>
      <div class="ad-footer-bar"><span>Exibindo <strong>${metrics.popMatrix.length}</strong> estação(ões). Clique em um POP para filtrar o inventário dele.</span></div>`;
  }

  if (tab === 'batteries') {
    const list = infraAlertsOnly ? metrics.batteries.filter(b => b.alert) : metrics.batteries;
    const totalTech = Math.max(1, metrics.batteries.length);
    const techBar = metrics.batteries.length ? `<div class="ad-tech-bar">
      <div class="ad-bar-meta"><strong>Tecnologia dos bancos (${metrics.batteries.length})</strong>
        <span class="small muted">Lítio LiFePO4: <strong>${metrics.batteryTech.litio}</strong> · VRLA/Chumbo: <strong>${metrics.batteryTech.vrla}</strong>${metrics.batteryTech.other ? ` · Outros: ${metrics.batteryTech.other}` : ''} · Alertas: <strong style="color:#b9142a">${metrics.batteryAlerts}</strong></span>
      </div>
      <div class="ad-tech-track">
        <span class="ad-tech-litio" style="width:${(metrics.batteryTech.litio / totalTech * 100).toFixed(1)}%"></span>
        <span class="ad-tech-vrla" style="width:${(metrics.batteryTech.vrla / totalTech * 100).toFixed(1)}%"></span>
        <span class="ad-tech-other" style="width:${(metrics.batteryTech.other / totalTech * 100).toFixed(1)}%"></span>
      </div>
    </div>` : '';
    if (!list.length) return techBar + '<div class="ad-empty">Nenhum banco de baterias encontrado com os filtros aplicados.</div>';
    return `${techBar}<div class="ad-table-scroll"><table class="ad-table">
      <thead><tr><th>Estação</th><th>Banco / Modelo</th><th>Tecnologia</th><th>Qtd · Cap.</th><th>Autonomia</th><th>Uso (meses)</th><th>Status</th></tr></thead>
      <tbody>${list.map(b => `<tr>
        <td><strong>${esc(b.station)}</strong>${b.assetTag ? `<div class="small muted ad-mono">${esc(b.assetTag)}</div>` : ''}</td>
        <td><strong>${esc(b.name || b.model || 'Banco')}</strong><div class="small muted">${esc([b.maker, b.model].filter(Boolean).join(' · '))}</div></td>
        <td>${esc(b.tech || '—')}</td>
        <td>${esc([b.qty ? b.qty + ' un' : '', b.capacity ? b.capacity + ' Ah' : '', b.voltage ? b.voltage + ' V' : ''].filter(Boolean).join(' · ') || '—')}</td>
        <td>${b.autonomy ? `<strong>${esc(b.autonomy)} h</strong>` : '—'}</td>
        <td>${b.ageMonths ? `${esc(b.ageMonths)} m` : (b.installed || '—')}</td>
        <td>${adPill(b.statusNorm)}${b.alert ? ' <span class="ad-pill ad-pill-warn">Revisar</span>' : ''}</td>
      </tr>`).join('')}</tbody></table></div>`;
  }

  if (tab === 'rectifiers') {
    const list = infraAlertsOnly ? metrics.rectifiers.filter(r => r.alert) : metrics.rectifiers;
    if (!list.length) return '<div class="ad-empty">Nenhuma retificadora encontrada com os filtros aplicados.</div>';
    return `<div class="ad-table-scroll"><table class="ad-table">
      <thead><tr><th>Estação</th><th>Fabricante / Modelo</th><th>Capacidade</th><th>URs (01–04)</th><th>Verificação</th><th>Status</th></tr></thead>
      <tbody>${list.map(r => {
        const urs = [r.ur01, r.ur02, r.ur03, r.ur04].map((v, i) => v ? `UR0${i + 1}: ${v}` : '').filter(Boolean).join(' · ');
        return `<tr>
          <td><strong>${esc(r.station)}</strong>${r.serial ? `<div class="small muted ad-mono">${esc(r.serial)}</div>` : ''}</td>
          <td><strong>${esc([r.maker, r.model].filter(Boolean).join(' · ') || 'Retificadora')}</strong>${r.modules ? `<div class="small muted">${esc(r.modules)} módulo(s)</div>` : ''}</td>
          <td>${esc([r.currentA ? r.currentA + ' A' : '', r.voltageV ? r.voltageV + ' V' : ''].filter(Boolean).join(' · ') || '—')}</td>
          <td class="small">${esc(urs || '—')}</td>
          <td class="small">Últ.: ${esc(r.lastCheck || '—')}${r.nextCheck ? `<br>Próx.: <strong>${esc(r.nextCheck)}</strong>` : ''}</td>
          <td>${adPill(r.statusNorm)}${r.alert ? ' <span class="ad-pill ad-pill-warn">Alerta</span>' : ''}</td>
        </tr>`;
      }).join('')}</tbody></table></div>`;
  }

  if (tab === 'climate') {
    const list = infraAlertsOnly ? metrics.climate.filter(c => c.alert) : metrics.climate;
    if (!list.length) return '<div class="ad-empty">Nenhum climatizador encontrado com os filtros aplicados.</div>';
    return `<div class="ad-table-scroll"><table class="ad-table">
      <thead><tr><th>Estação</th><th>Fabricante / Modelo</th><th>Capacidade / Gás</th><th>Temp. / Corrente</th><th>Próx. manutenção</th><th>Status</th></tr></thead>
      <tbody>${list.map(c => {
        const temp = adParseNum(c.tempC);
        const tempBadge = c.tempC ? `<span class="${temp !== null && temp > 26 ? 'ad-pill ad-pill-crit' : ''}">${esc(c.tempC)} °C</span>` : '—';
        return `<tr>
          <td><strong>${esc(c.station)}</strong>${c.serial ? `<div class="small muted ad-mono">${esc(c.serial)}</div>` : ''}</td>
          <td><strong>${esc([c.maker, c.model].filter(Boolean).join(' · ') || 'Climatizador')}</strong>${c.type ? `<div class="small muted">${esc(c.type)}</div>` : ''}</td>
          <td class="small">${esc([c.btus ? c.btus + ' BTUs' : '', c.gas, c.gasCharge].filter(Boolean).join(' · ') || '—')}</td>
          <td>${tempBadge}${c.currentA ? `<div class="small muted">${esc(c.currentA)} A</div>` : ''}</td>
          <td class="small">${esc(c.nextMaint || c.lastInspection || '—')}</td>
          <td>${adPill(c.statusNorm)}${c.alert ? ' <span class="ad-pill ad-pill-warn">Alerta</span>' : ''}</td>
        </tr>`;
      }).join('')}</tbody></table></div>`;
  }

  if (tab === 'events') {
    if (!metrics.events.length) return '<div class="ad-empty">Nenhuma movimentação recente de auditoria encontrada.</div>';
    return `<div class="ad-table-scroll"><table class="ad-table">
      <thead><tr><th>Momento</th><th>POP</th><th>Ação</th><th>Aba</th><th>Detalhe</th><th>Inspeção</th></tr></thead>
      <tbody>${metrics.events.map(e => {
        const cls = e.action === 'PENDENCIA' ? 'ad-pill-warn' : e.action === 'CRIADO' || e.action === 'SUBSTITUIDO' ? 'ad-pill-info' : 'ad-pill-ok';
        return `<tr>
          <td class="small">${esc(e.at || '—')}</td>
          <td class="ad-mono">${esc(e.stationCode || '—')}</td>
          <td><span class="ad-pill ${cls}">${esc(e.action || '—')}</span></td>
          <td class="small">${esc(e.tab || '—')}</td>
          <td class="small">${esc(e.detail || '—')}</td>
          <td class="ad-mono small">${esc(e.inspectionId || '—')}</td>
        </tr>`;
      }).join('')}</tbody></table></div>`;
  }

  // Default: Inventário Geral (Ativos)
  const sorted = adSortRows(metrics.filteredAssets, sortBy, sortDir);
  if (!sorted.length) return '<div class="ad-empty">Nenhum ativo encontrado com os filtros atuais.</div>';
  const shown = sorted.slice(0, pageSize);
  return `<div class="ad-table-scroll"><table class="ad-table">
    <thead><tr>
      ${sortHeader('station', 'POP / Local')}
      ${sortHeader('category', 'Categoria / Equip.')}
      ${sortHeader('maker', 'Fabricante / Modelo')}
      ${sortHeader('serial', 'Nº Série')}
      ${sortHeader('assetTag', 'Patrimônio')}
      ${sortHeader('statusNorm', 'Status')}
      ${sortHeader('lastInspection', 'Últ. Inspeção')}
    </tr></thead>
    <tbody>${shown.map(item => `<tr class="ad-clickable" data-ad-asset-idx="${item._idx}" title="Clique para ver detalhes">
      <td><strong>${esc(item.station)}</strong>${item.stationCode ? `<div class="small muted ad-mono">${esc(item.stationCode)}</div>` : ''}</td>
      <td><strong>${esc(item.equipment)}</strong><div class="small muted">${esc(item.category)}</div></td>
      <td><strong>${esc(item.maker || '—')}</strong><div class="small muted">${esc(item.model || '—')}</div></td>
      <td class="ad-mono">${esc(item.serial || '—')}</td>
      <td class="ad-mono">${esc(item.assetTag || '—')}</td>
      <td>${adPill(item.statusNorm)}</td>
      <td class="small">${esc(item.lastInspection || '—')}${item.stale ? '<div style="color:#4c3591;font-weight:650">&gt; 90 dias</div>' : ''}</td>
    </tr>`).join('')}</tbody></table></div>
    <div class="ad-footer-bar">
      <span>Exibindo <strong>${shown.length}</strong> de <strong>${sorted.length}</strong> ativos (clique em uma linha para abrir detalhes).</span>
      ${sorted.length > shown.length ? `<button type="button" class="btn tiny" data-ad-more>Mostrar mais (+50)</button>` : ''}
    </div>`;
}

function adRenderChips() {
  const chips = [];
  if (assetDashState.search) chips.push(['search', `Busca: "${assetDashState.search}"`]);
  if (assetDashState.station) chips.push(['station', `POP: ${assetDashState.station}`]);
  if (assetDashState.category) chips.push(['category', `Categoria: ${assetDashState.category}`]);
  if (assetDashState.status) chips.push(['status', `Status: ${assetDashState.status}`]);
  if (assetDashState.maker) chips.push(['maker', `Fabricante: ${assetDashState.maker}`]);
  if (assetDashState.staleOnly) chips.push(['staleOnly', 'Sem vistoria (> 90 dias)']);
  if (assetDashState.infraAlertsOnly) chips.push(['infraAlertsOnly', 'Somente alertas de infra']);
  if (assetDashState.qualityFilter === 'missingId') chips.push(['qualityFilter', 'Sem série e sem patrimônio']);
  if (assetDashState.qualityFilter === 'duplicateSerial') chips.push(['qualityFilter', 'Séries duplicadas']);
  if (assetDashState.qualityFilter === 'unrated') chips.push(['qualityFilter', 'Status não informado']);
  if (!chips.length) return '';
  return `<div class="ad-chips">${chips.map(([k, label]) =>
    `<button type="button" class="ad-chip" data-ad-clear-filter="${k}">${esc(label)} ×</button>`
  ).join('')}<button type="button" class="btn tiny" data-ad-clear-all>Limpar todos</button></div>`;
}

function renderAssetsDashboard() {
  const pane = document.getElementById('portal-assets-pane');
  if (!pane) return;
  if (googleUser?.role !== 'GESTAO') {
    pane.innerHTML = '<p class="portal-module-status" role="status">O Dashboard de Ativos está disponível apenas para o perfil Gestão.</p>';
    return;
  }

  if (assetDashState.loading && !assetDashState.data) {
    pane.innerHTML = `<main class="ad-shell">
      <header class="ad-header"><div><h1>Dashboard de Ativos</h1><p>Carregando inventário consolidado dos POPs direto da base de dados…</p></div></header>
      <div class="ad-empty">Consultando abas Ativos, Baterias, Retificadores e Climatização…</div>
    </main>`;
    return;
  }

  if (assetDashState.error && !assetDashState.data) {
    pane.innerHTML = `<main class="ad-shell">
      <header class="ad-header"><div><h1>Dashboard de Ativos</h1><p>Não foi possível carregar a base de ativos.</p></div>
        <div class="ad-header-actions"><button type="button" class="btn primary tiny" data-ad-refresh>Tentar novamente</button></div>
      </header>
      <div class="ad-empty">${esc(assetDashState.error)}</div>
    </main>`;
    return;
  }

  const metrics = computeAssetDashboardMetrics(assetDashState.data || {}, assetDashState);
  const refreshed = assetDashState.data?.refreshedAt
    ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(assetDashState.data.refreshedAt))
    : '—';

  const optList = (values, selected, allLabel) =>
    `<option value="">${allLabel}</option>` + values.map(v => `<option value="${esc(v)}" ${selected === v ? 'selected' : ''}>${esc(v)}</option>`).join('');

  pane.innerHTML = `<main class="ad-shell">
    <header class="ad-header">
      <div>
        <h1>Dashboard de Ativos</h1>
        <p>Parque consolidado das inspeções POPs · Atualizado em ${esc(refreshed)}${assetDashState.error ? ' · ' + esc(assetDashState.error) : ''}</p>
      </div>
      <div class="ad-header-actions">
        <button type="button" class="btn tiny" data-ad-copy-link>Copiar link</button>
        <button type="button" class="btn tiny" data-ad-export-pdf>Baixar PDF Executivo</button>
        <button type="button" class="btn tiny" data-ad-export-xlsx>Baixar Excel</button>
        <button type="button" class="btn tiny" data-ad-export-csv>Exportar CSV</button>
        <button type="button" class="btn tiny" data-ad-send-summary>Enviar resumo por e-mail</button>
        <button type="button" class="btn primary tiny" data-ad-refresh ${assetDashState.loading ? 'disabled' : ''}>${assetDashState.loading ? 'Atualizando…' : 'Atualizar base'}</button>
      </div>
    </header>

    <section class="ad-kpis" aria-label="Indicadores principais de ativos">
      <button type="button" class="ad-kpi ${!assetDashState.status && !assetDashState.staleOnly && !assetDashState.infraAlertsOnly ? 'is-active' : ''}" data-ad-kpi="all">
        <span class="ad-kpi-label">Total de ativos</span>
        <strong class="ad-kpi-value">${metrics.totalBase}</strong>
        <span class="ad-kpi-sub">${metrics.stationCount} POP(s) no filtro</span>
      </button>
      <button type="button" class="ad-kpi kpi-ok ${assetDashState.status === 'Operacional' ? 'is-active' : ''}" data-ad-kpi="Operacional">
        <span class="ad-kpi-label">Operacionais</span>
        <strong class="ad-kpi-value">${metrics.statusCounts.Operacional}</strong>
        <span class="ad-kpi-sub">${metrics.healthPct}% de saúde</span>
      </button>
      <button type="button" class="ad-kpi kpi-warn ${assetDashState.status === 'Atenção' ? 'is-active' : ''}" data-ad-kpi="Atenção">
        <span class="ad-kpi-label">Em atenção</span>
        <strong class="ad-kpi-value">${metrics.statusCounts['Atenção']}</strong>
        <span class="ad-kpi-sub">Monitorar na próxima visita</span>
      </button>
      <button type="button" class="ad-kpi kpi-crit ${assetDashState.status === 'Crítico' ? 'is-active' : ''}" data-ad-kpi="Crítico">
        <span class="ad-kpi-label">Críticos</span>
        <strong class="ad-kpi-value">${metrics.statusCounts['Crítico']}</strong>
        <span class="ad-kpi-sub">Ação prioritária / troca</span>
      </button>
      <button type="button" class="ad-kpi kpi-stale ${assetDashState.staleOnly ? 'is-active' : ''}" data-ad-kpi="stale">
        <span class="ad-kpi-label">Sem vistoria &gt; 90d</span>
        <strong class="ad-kpi-value">${metrics.staleCount}</strong>
        <span class="ad-kpi-sub">Inventário desatualizado</span>
      </button>
      <button type="button" class="ad-kpi kpi-infra ${assetDashState.infraAlertsOnly ? 'is-active' : ''}" data-ad-kpi="infra">
        <span class="ad-kpi-label">Alertas energia/clima</span>
        <strong class="ad-kpi-value">${metrics.infraAlertCount}</strong>
        <span class="ad-kpi-sub">${metrics.batteryAlerts} bat · ${metrics.rectifierAlerts} ret · ${metrics.climateAlerts} clima</span>
      </button>
    </section>

    <section class="ad-filters-card" aria-label="Filtros do inventário">
      <div class="ad-filters-grid">
        <label class="ad-filter-field">
          <span>Buscar por nº de série, patrimônio, modelo ou POP</span>
          <input id="ad-search-input" type="search" placeholder="Ex.: SN1234, PAT-0042, Huawei, OLT, Curralinho…" value="${esc(assetDashState.search)}">
        </label>
        <label class="ad-filter-field">
          <span>POP / Estação</span>
          <select data-ad-select="station">${optList(metrics.facets.stations, assetDashState.station, 'Todos os POPs')}</select>
        </label>
        <label class="ad-filter-field">
          <span>Categoria</span>
          <select data-ad-select="category">${optList(metrics.facets.categories, assetDashState.category, 'Todas categorias')}</select>
        </label>
        <label class="ad-filter-field">
          <span>Status</span>
          <select data-ad-select="status">${optList(['Operacional', 'Atenção', 'Crítico', 'Inativo', 'Sem status'], assetDashState.status, 'Todos status')}</select>
        </label>
        <label class="ad-filter-field">
          <span>Fabricante</span>
          <select data-ad-select="maker">${optList(metrics.facets.makers, assetDashState.maker, 'Todos fabricantes')}</select>
        </label>
        <button type="button" class="btn tiny" data-ad-clear-all>Limpar</button>
      </div>
      ${adRenderChips()}
      <div class="ad-quality-bar" aria-label="Qualidade e governança do cadastro">
        <span class="ad-quality-score">Qualidade do cadastro: <strong>${metrics.quality.qualityPct}%</strong></span>
        <button type="button" class="ad-quality-btn ${assetDashState.qualityFilter === 'missingId' ? 'is-active' : ''}" data-ad-quality="missingId">Sem série e patrimônio: <strong>${metrics.quality.missingBoth}</strong></button>
        <button type="button" class="ad-quality-btn ${assetDashState.qualityFilter === 'duplicateSerial' ? 'is-active' : ''}" data-ad-quality="duplicateSerial">Séries duplicadas: <strong>${metrics.quality.duplicateSerialCount}</strong></button>
        <button type="button" class="ad-quality-btn ${assetDashState.qualityFilter === 'unrated' ? 'is-active' : ''}" data-ad-quality="unrated">Sem status: <strong>${metrics.quality.unratedCount}</strong></button>
      </div>
    </section>

    <section class="ad-charts" aria-label="Gráficos interativos">
      <article class="ad-panel">
        <div class="ad-panel-head"><h2>Saúde do parque</h2><span>clique para filtrar</span></div>
        ${adRenderDonut(metrics.statusCounts, metrics.totalBase, metrics.healthPct, assetDashState.status)}
      </article>
      <article class="ad-panel">
        <div class="ad-panel-head"><h2>Ranking de POPs críticos</h2><span>críticos + atenção</span></div>
        ${adRenderPopRanking(metrics.popRanking, assetDashState.station)}
      </article>
      <article class="ad-panel">
        <div class="ad-panel-head"><h2>Ativos por categoria</h2><span>top 10</span></div>
        ${adRenderCategoryBars(metrics.categoryRanking, assetDashState.category)}
      </article>
    </section>

    <section class="ad-table-card" aria-label="Listagem detalhada de ativos">
      <div class="ad-tabs" role="tablist">
        <button type="button" class="ad-tab" role="tab" aria-selected="${assetDashState.tab === 'assets'}" data-ad-tab="assets">Inventário Geral <span class="ad-tab-count">${metrics.filteredAssets.length}</span></button>
        <button type="button" class="ad-tab" role="tab" aria-selected="${assetDashState.tab === 'pops'}" data-ad-tab="pops">Por POP <span class="ad-tab-count">${metrics.popMatrix.length}</span></button>
        <button type="button" class="ad-tab" role="tab" aria-selected="${assetDashState.tab === 'batteries'}" data-ad-tab="batteries">Baterias <span class="ad-tab-count">${metrics.batteries.length}</span></button>
        <button type="button" class="ad-tab" role="tab" aria-selected="${assetDashState.tab === 'rectifiers'}" data-ad-tab="rectifiers">Retificadoras <span class="ad-tab-count">${metrics.rectifiers.length}</span></button>
        <button type="button" class="ad-tab" role="tab" aria-selected="${assetDashState.tab === 'climate'}" data-ad-tab="climate">Climatização <span class="ad-tab-count">${metrics.climate.length}</span></button>
        <button type="button" class="ad-tab" role="tab" aria-selected="${assetDashState.tab === 'events'}" data-ad-tab="events">Movimentações <span class="ad-tab-count">${metrics.events.length}</span></button>
      </div>
      ${adRenderTableSection(metrics)}
    </section>
    <dialog id="ad-asset-dialog" class="ad-dialog"></dialog>
  </main>`;
}

function adOpenAssetDetail(idx) {
  const item = assetDashState.data?.assets?.[idx];
  const dialog = document.getElementById('ad-asset-dialog');
  if (!item || !dialog) return;
  const st = adNormalizeStatus(item.status);
  const fields = [
    ['POP / Estação', item.station],
    ['Código POP', item.stationCode || '—'],
    ['Categoria', item.category],
    ['Equipamento', item.equipment],
    ['Fabricante', item.maker || '—'],
    ['Modelo', item.model || '—'],
    ['Nº de Série', item.serial || '—'],
    ['Patrimônio', item.assetTag || '—'],
    ['ID do Ativo', item.id || '—'],
    ['Última Inspeção', item.lastInspection || '—'],
    ['ID da Inspeção', item.inspectionId || '—']
  ];
  dialog.innerHTML = `<div class="ad-dialog-head">
    <div><h3>${esc(item.equipment || 'Ativo')} · ${esc(item.model || item.maker || '')}</h3>${adPill(st)}</div>
    <button type="button" class="btn tiny" data-ad-close-dialog>Fechar</button>
  </div>
  <div class="ad-dialog-body">
    <dl class="ad-detail-grid">${fields.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
    ${item.note ? `<div class="small"><strong>Observações:</strong> ${esc(item.note)}</div>` : ''}
    <div class="btnrow">
      <button type="button" class="btn tiny" data-ad-filter-station-close="${esc(item.station)}">Filtrar este POP</button>
      ${item.inspectionId && typeof googleInspectionAssets === 'function' ? `<button type="button" class="btn tiny primary" data-ad-open-insp="${esc(item.inspectionId)}">Ver equipamentos da inspeção</button>` : ''}
    </div>
  </div>`;
  dialog.showModal();
}

async function loadAssetsDashboard(forceRefresh = false) {
  if (googleUser?.role !== 'GESTAO') {
    renderAssetsDashboard();
    return;
  }
  if (assetDashState.loading) return;
  assetDashState.loading = true;
  assetDashState.error = '';
  renderAssetsDashboard();
  const session = typeof googleSession !== 'undefined' ? googleSession : 0;
  try {
    const res = await googleRpc('assetsDashboard', { refresh: forceRefresh });
    if (typeof googleSession !== 'undefined' && session !== googleSession) return;
    assetDashState.data = res;
    assetDashState.loaded = true;
  } catch (error) {
    if (typeof googleSession !== 'undefined' && session !== googleSession) return;
    assetDashState.error = error.message || 'Falha ao consultar a base de ativos.';
  } finally {
    assetDashState.loading = false;
    renderAssetsDashboard();
  }
}

function adApplyUrlFilters() {
  try {
    const params = new URL(location.href).searchParams;
    if (params.get('modulo') !== 'ativos') return;
    if (params.has('pop')) assetDashState.station = params.get('pop') || '';
    if (params.has('cat')) assetDashState.category = params.get('cat') || '';
    if (params.has('status')) assetDashState.status = params.get('status') || '';
    if (params.has('fab')) assetDashState.maker = params.get('fab') || '';
    if (params.has('q')) assetDashState.search = params.get('q') || '';
    const aba = params.get('aba');
    if (['assets', 'pops', 'batteries', 'rectifiers', 'climate', 'events'].includes(aba)) assetDashState.tab = aba;
  } catch (_) {}
}

function adBuildShareUrl(state, baseHref = (typeof location !== 'undefined' ? location.href : 'https://example.test/')) {
  const url = new URL(baseHref);
  url.search = '';
  url.hash = '';
  url.searchParams.set('modulo', 'ativos');
  if (state.station) url.searchParams.set('pop', state.station);
  if (state.category) url.searchParams.set('cat', state.category);
  if (state.status) url.searchParams.set('status', state.status);
  if (state.maker) url.searchParams.set('fab', state.maker);
  if (state.search) url.searchParams.set('q', state.search);
  if (state.tab && state.tab !== 'assets') url.searchParams.set('aba', state.tab);
  return url.href;
}

async function buildAssetsWorkbook(metrics, filters) {
  const loader = typeof loadFttxExcelLibrary === 'function'
    ? loadFttxExcelLibrary
    : () => new Promise((resolve, reject) => {
        if (window.ExcelJS) return resolve(window.ExcelJS);
        const s = document.createElement('script');
        s.src = './vendor/exceljs-4.4.0.min.js';
        s.onload = () => resolve(window.ExcelJS);
        s.onerror = () => reject(Error('Não foi possível carregar o exportador Excel.'));
        document.head.append(s);
      });
  const { Workbook } = await loader();
  const book = new Workbook();
  book.creator = 'VOANET · Infraestrutura';
  const safeCell = v => {
    const s = String(v ?? '');
    return /^[\s]*[=+\-@]/.test(s) ? "'" + s : s;
  };
  const styleHead = row => {
    row.height = 24;
    row.eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB9142A' } };
      cell.alignment = { vertical: 'middle' };
    });
  };

  const sResumo = book.addWorksheet('Resumo');
  sResumo.addRow(['Indicador', 'Valor', 'Detalhe']);
  styleHead(sResumo.getRow(1));
  sResumo.addRow(['Total de ativos', metrics.totalBase, `${metrics.stationCount} POP(s)`]);
  sResumo.addRow(['Operacionais', metrics.statusCounts.Operacional, `${metrics.healthPct}% de saúde`]);
  sResumo.addRow(['Em atenção', metrics.statusCounts['Atenção'], 'Monitoramento']);
  sResumo.addRow(['Críticos', metrics.statusCounts['Crítico'], 'Ação prioritária']);
  sResumo.addRow(['Sem vistoria > 90 dias', metrics.staleCount, 'Inventário desatualizado']);
  sResumo.addRow(['Alertas energia/clima', metrics.infraAlertCount, `${metrics.batteryAlerts} bat · ${metrics.rectifierAlerts} ret · ${metrics.climateAlerts} clima`]);
  sResumo.addRow(['Qualidade cadastral', `${metrics.quality.qualityPct}%`, `${metrics.quality.missingBoth} sem ID · ${metrics.quality.duplicateSerialCount} séries duplicadas`]);
  sResumo.addRow([]);
  const mHead = sResumo.addRow(['POP / Estação', 'Código', 'Ativos', 'Saúde (%)', 'Críticos', 'Atenção', 'Baterias', 'Retificadoras', 'Clima', 'Alertas Infra', 'Últ. Inspeção']);
  styleHead(mHead);
  for (const p of metrics.popMatrix) {
    sResumo.addRow([safeCell(p.station), safeCell(p.stationCode), p.total, p.healthPct ?? '—', p.crit, p.warn, p.batteries, p.rectifiers, p.climate, p.alerts, safeCell(p.lastInspection)]);
  }
  sResumo.columns.forEach(c => { c.width = 20; });

  const addSheet = (title, headers, rows) => {
    const ws = book.addWorksheet(title, { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.addRow(headers);
    styleHead(ws.getRow(1));
    for (const r of rows) ws.addRow(r.map(safeCell));
    ws.columns.forEach(c => { c.width = 18; });
  };

  addSheet('Ativos',
    ['POP / Local', 'Código POP', 'Categoria', 'Equipamento', 'Fabricante', 'Modelo', 'Nº Série', 'Patrimônio', 'Status', 'Última inspeção', 'Observações'],
    metrics.filteredAssets.map(a => [a.station, a.stationCode, a.category, a.equipment, a.maker, a.model, a.serial, a.assetTag, a.statusNorm, a.lastInspection, a.note]));
  addSheet('Baterias',
    ['Estação', 'Descrição', 'Tecnologia', 'Fabricante', 'Modelo', 'Qtd', 'Tensão (V)', 'Cap. (Ah)', 'Autonomia (h)', 'Uso (meses)', 'Status', 'Patrimônio'],
    metrics.batteries.map(b => [b.station, b.name, b.tech, b.maker, b.model, b.qty, b.voltage, b.capacity, b.autonomy, b.ageMonths, b.statusNorm, b.assetTag]));
  addSheet('Retificadoras',
    ['Estação', 'Fabricante', 'Modelo', 'Módulos', 'Corrente (A)', 'Tensão (V)', 'UR01', 'UR02', 'UR03', 'UR04', 'Últ. Verif.', 'Próx. Verif.', 'Status'],
    metrics.rectifiers.map(r => [r.station, r.maker, r.model, r.modules, r.currentA, r.voltageV, r.ur01, r.ur02, r.ur03, r.ur04, r.lastCheck, r.nextCheck, r.statusNorm]));
  addSheet('Climatização',
    ['Estação', 'Fabricante', 'Modelo', 'BTUs', 'Tipo', 'Gás', 'Corrente (A)', 'Temp. (°C)', 'Próx. Manutenção', 'Status', 'Nº Série'],
    metrics.climate.map(c => [c.station, c.maker, c.model, c.btus, c.type, c.gas, c.currentA, c.tempC, c.nextMaint, c.statusNorm, c.serial]));

  return book.xlsx.writeBuffer();
}

function mountAssetsDashboard() {
  adApplyUrlFilters();
  if (!assetDashState.loaded && !assetDashState.loading) {
    loadAssetsDashboard(false);
  } else {
    renderAssetsDashboard();
  }
}

function resetAssetsDashboard() {
  assetDashState = {
    loading: false, loaded: false, error: '', data: null,
    tab: 'assets', search: '', station: '', category: '', status: '', maker: '',
    staleOnly: false, infraAlertsOnly: false, qualityFilter: '', sortBy: 'station', sortDir: 'asc', pageSize: 50
  };
}

function adIsPaneActive() {
  const pane = document.getElementById('portal-assets-pane');
  return Boolean(pane && !pane.hidden && googleUser?.role === 'GESTAO');
}

document.addEventListener('input', event => {
  if (event.target.id !== 'ad-search-input' || !adIsPaneActive()) return;
  const val = event.target.value;
  clearTimeout(assetDashSearchTimer);
  assetDashSearchTimer = setTimeout(() => {
    assetDashState.search = val;
    assetDashState.pageSize = 50;
    const pos = event.target.selectionStart;
    renderAssetsDashboard();
    const fresh = document.getElementById('ad-search-input');
    if (fresh) { fresh.focus({ preventScroll: true }); try { fresh.setSelectionRange(pos, pos); } catch (_) {} }
  }, 140);
});

document.addEventListener('change', event => {
  if (!adIsPaneActive()) return;
  const key = event.target.dataset.adSelect;
  if (!key) return;
  assetDashState[key] = event.target.value;
  assetDashState.pageSize = 50;
  renderAssetsDashboard();
});

async function buildAssetsExecutivePdf(metrics, filters, refreshedAt) {
  const { PDFDocument, StandardFonts, rgb } = await loadGooglePdfLibrary();
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const chars = new Set(regular.getCharacterSet());
  const red = rgb(.72, .08, .16), ink = rgb(.10, .15, .22), muted = rgb(.35, .42, .50), tint = rgb(.95, .96, .98), lineCol = rgb(.85, .89, .93);
  let page = doc.addPage([595.28, 841.89]);
  let y = 785;
  const sanitize = v => [...String(v ?? '').normalize('NFC').replace(/\s+/g, ' ').trim()].map(c => chars.has(c.codePointAt(0)) ? c : '-').join('') || '—';
  const draw = (val, x, yy, size = 10, font = regular, color = ink, maxW = 500) => {
    let clean = sanitize(val);
    if (font.widthOfTextAtSize(clean, size) > maxW) {
      while (clean && font.widthOfTextAtSize(clean + '…', size) > maxW) clean = clean.slice(0, -1);
      clean = clean.trimEnd() + '…';
    }
    page.drawText(clean, { x, y: yy, size, font, color });
  };
  const ensureSpace = needed => {
    if (y - needed < 56) {
      page = doc.addPage([595.28, 841.89]);
      y = 790;
    }
  };
  try {
    const res = await fetch('./voanet.png');
    const logo = await doc.embedPng(await res.arrayBuffer());
    page.drawImage(logo, { x: 44, y: 774, width: 112, height: 112 * logo.height / logo.width });
  } catch (_) { draw('VOANET', 44, 782, 16, bold, red); }
  draw('Relatório Executivo — Parque de Ativos POPs', 172, 790, 15, bold, ink, 380);
  const activeFilterNote = [filters.station && 'POP: ' + filters.station, filters.category && 'Cat.: ' + filters.category, filters.status && 'Status: ' + filters.status, filters.search && 'Busca: ' + filters.search].filter(Boolean).join(' · ') || 'Base completa (sem filtros)';
  draw('Gerado em ' + new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date()) + ' · ' + activeFilterNote, 172, 773, 8.5, regular, muted, 380);
  page.drawLine({ start: { x: 44, y: 760 }, end: { x: 551, y: 760 }, thickness: .8, color: lineCol });
  y = 740;

  const kpis = [
    ['Total de ativos', String(metrics.totalBase), metrics.stationCount + ' POP(s)'],
    ['Operacionais', String(metrics.statusCounts.Operacional), metrics.healthPct + '% de saúde'],
    ['Em atenção', String(metrics.statusCounts['Atenção']), 'Monitoramento'],
    ['Críticos', String(metrics.statusCounts['Crítico']), 'Ação prioritária'],
    ['Sem vistoria >90d', String(metrics.staleCount), 'Desatualizados'],
    ['Alertas infra', String(metrics.infraAlertCount), metrics.batteryAlerts + 'b · ' + metrics.rectifierAlerts + 'r · ' + metrics.climateAlerts + 'c']
  ];
  kpis.forEach(([lbl, val, sub], i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = 44 + col * 172, yy = y - row * 56;
    page.drawRectangle({ x, y: yy - 42, width: 162, height: 48, color: tint });
    draw(lbl, x + 10, yy - 8, 8, bold, muted, 142);
    draw(val, x + 10, yy - 26, 16, bold, i === 3 ? red : ink, 142);
    draw(sub, x + 10, yy - 38, 7.5, regular, muted, 142);
  });
  y -= 126;

  draw('Ranking de POPs por Criticidade (Top 10)', 44, y, 12, bold, ink);
  y -= 18;
  for (const r of metrics.popRanking.slice(0, 10)) {
    ensureSpace(16);
    draw(r.station, 44, y, 9.5, bold, ink, 250);
    draw(`Críticos: ${r.crit}  ·  Atenção: ${r.warn}  ·  Operacionais: ${r.ok}  ·  Total: ${r.total}`, 300, y, 8.5, regular, r.crit > 0 ? red : muted, 250);
    y -= 15;
  }

  const criticalList = metrics.filteredAssets.filter(a => a.statusNorm === 'Crítico' || a.statusNorm === 'Atenção');
  y -= 10;
  ensureSpace(36);
  draw(`Ativos em Estado Crítico ou Atenção (${criticalList.length})`, 44, y, 12, bold, red);
  y -= 18;
  if (!criticalList.length) {
    draw('Nenhum ativo crítico ou em atenção no filtro atual.', 44, y, 9.5, regular, muted);
    y -= 16;
  } else {
    for (const a of criticalList.slice(0, 40)) {
      ensureSpace(16);
      draw(`${a.station} · ${a.equipment} ${a.model || ''}`, 44, y, 8.8, bold, ink, 270);
      draw(`Série: ${a.serial || '—'} · Pat.: ${a.assetTag || '—'}`, 320, y, 8.2, regular, muted, 160);
      draw(a.statusNorm, 488, y, 8.5, bold, a.statusNorm === 'Crítico' ? red : ink, 65);
      y -= 14;
    }
  }

  const alerts = [
    ...metrics.batteries.filter(b => b.alert).map(b => `[Bateria] ${b.station} · ${b.model || b.name} (${b.tech || '—'}, ${b.ageMonths || '—'}m, aut. ${b.autonomy || '—'}h)`),
    ...metrics.rectifiers.filter(r => r.alert).map(r => `[Retificadora] ${r.station} · ${r.maker} ${r.model} (próx. ${r.nextCheck || '—'})`),
    ...metrics.climate.filter(c => c.alert).map(c => `[Clima] ${c.station} · ${c.maker} ${c.model} (${c.tempC ? c.tempC + ' °C' : c.statusNorm})`)
  ];
  if (alerts.length) {
    y -= 10;
    ensureSpace(32);
    draw(`Alertas de Energia e Climatização (${alerts.length})`, 44, y, 12, bold, ink);
    y -= 18;
    for (const line of alerts.slice(0, 30)) {
      ensureSpace(14);
      draw(line, 44, y, 8.5, regular, ink, 505);
      y -= 13;
    }
  }
  return doc.save();
}

document.addEventListener('click', async event => {
  if (!adIsPaneActive()) return;
  const target = event.target;
  if (target.closest('[data-ad-refresh]')) { loadAssetsDashboard(true); return; }
  const copyBtn = target.closest('[data-ad-copy-link]');
  if (copyBtn) {
    const shareUrl = adBuildShareUrl(assetDashState);
    try { history.replaceState(null, '', shareUrl); } catch (_) {}
    try {
      await navigator.clipboard.writeText(shareUrl);
      const old = copyBtn.textContent;
      copyBtn.textContent = 'Link copiado!';
      setTimeout(() => { if (copyBtn.isConnected) copyBtn.textContent = old; }, 2200);
    } catch (_) {
      prompt('Copie o link filtrado do Dashboard de Ativos:', shareUrl);
    }
    return;
  }
  const xlsxBtn = target.closest('[data-ad-export-xlsx]');
  if (xlsxBtn) {
    if (xlsxBtn.disabled) return;
    xlsxBtn.disabled = true;
    const old = xlsxBtn.textContent;
    xlsxBtn.textContent = 'Gerando Excel…';
    try {
      const metrics = computeAssetDashboardMetrics(assetDashState.data || {}, assetDashState);
      const buffer = await buildAssetsWorkbook(metrics, assetDashState);
      const date = new Intl.DateTimeFormat('sv-SE').format(new Date());
      download(buffer, `VOANET-Ativos-${date}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    } catch (err) {
      alert('Não foi possível gerar o Excel: ' + err.message);
    } finally {
      xlsxBtn.disabled = false;
      xlsxBtn.textContent = old;
    }
    return;
  }
  const qBtn = target.closest('[data-ad-quality]');
  if (qBtn) {
    const mode = qBtn.dataset.adQuality;
    assetDashState.qualityFilter = assetDashState.qualityFilter === mode ? '' : mode;
    assetDashState.tab = 'assets';
    assetDashState.pageSize = 50;
    renderAssetsDashboard();
    return;
  }
  const popJump = target.closest('[data-ad-pop-jump]');
  if (popJump) {
    assetDashState.station = popJump.dataset.adPopJump;
    assetDashState.tab = 'assets';
    assetDashState.pageSize = 50;
    renderAssetsDashboard();
    return;
  }
  const pdfBtn = target.closest('[data-ad-export-pdf]');
  if (pdfBtn) {
    if (pdfBtn.disabled) return;
    pdfBtn.disabled = true;
    const prevText = pdfBtn.textContent;
    pdfBtn.textContent = 'Gerando PDF…';
    try {
      const metrics = computeAssetDashboardMetrics(assetDashState.data || {}, assetDashState);
      const bytes = await buildAssetsExecutivePdf(metrics, assetDashState, assetDashState.data?.refreshedAt);
      const date = new Intl.DateTimeFormat('sv-SE').format(new Date());
      download(bytes, `VOANET-Ativos-Executivo-${date}.pdf`, 'application/pdf');
    } catch (err) {
      alert('Não foi possível gerar o PDF: ' + err.message);
    } finally {
      pdfBtn.disabled = false;
      pdfBtn.textContent = prevText;
    }
    return;
  }
  const summaryBtn = target.closest('[data-ad-send-summary]');
  if (summaryBtn) {
    if (summaryBtn.disabled) return;
    if (!confirm('Enviar agora o resumo executivo de POPs vencidos e ativos críticos por e-mail para todos os gestores ativos?')) return;
    summaryBtn.disabled = true;
    const prevText = summaryBtn.textContent;
    summaryBtn.textContent = 'Enviando…';
    try {
      const res = await googleRpc('sendWeeklySummary', {});
      alert(`Resumo enviado com sucesso para ${res.sent} gestor(es) (${res.stats?.overdue || 0} POP(s) vencido(s), ${res.stats?.critAssets || 0} ativo(s) crítico(s)).`);
    } catch (err) {
      alert('Falha ao enviar resumo: ' + err.message);
    } finally {
      summaryBtn.disabled = false;
      summaryBtn.textContent = prevText;
    }
    return;
  }
  if (target.closest('[data-ad-export-csv]')) {
    const metrics = computeAssetDashboardMetrics(assetDashState.data || {}, assetDashState);
    const csv = adBuildCsv(assetDashState.tab, metrics);
    const date = new Intl.DateTimeFormat('sv-SE').format(new Date());
    download(csv, `VOANET-Ativos-${assetDashState.tab}-${date}.csv`, 'text/csv;charset=utf-8');
    return;
  }
  const kpi = target.closest('[data-ad-kpi]');
  if (kpi) {
    const mode = kpi.dataset.adKpi;
    if (mode === 'all') {
      assetDashState.status = ''; assetDashState.staleOnly = false; assetDashState.infraAlertsOnly = false;
    } else if (mode === 'stale') {
      assetDashState.staleOnly = !assetDashState.staleOnly; assetDashState.infraAlertsOnly = false; assetDashState.tab = 'assets';
    } else if (mode === 'infra') {
      assetDashState.infraAlertsOnly = !assetDashState.infraAlertsOnly;
      assetDashState.staleOnly = false;
      if (assetDashState.infraAlertsOnly && assetDashState.tab === 'assets') assetDashState.tab = 'batteries';
    } else {
      assetDashState.status = assetDashState.status === mode ? '' : mode;
      assetDashState.staleOnly = false; assetDashState.infraAlertsOnly = false; assetDashState.tab = 'assets';
    }
    assetDashState.pageSize = 50;
    renderAssetsDashboard();
    return;
  }
  const stBtn = target.closest('[data-ad-filter-status]');
  if (stBtn) {
    const v = stBtn.dataset.adFilterStatus;
    assetDashState.status = assetDashState.status === v ? '' : v;
    assetDashState.pageSize = 50;
    renderAssetsDashboard();
    return;
  }
  const popBtn = target.closest('[data-ad-filter-station]');
  if (popBtn) {
    const v = popBtn.dataset.adFilterStation;
    assetDashState.station = assetDashState.station === v ? '' : v;
    assetDashState.pageSize = 50;
    renderAssetsDashboard();
    return;
  }
  const catBtn = target.closest('[data-ad-filter-category]');
  if (catBtn) {
    const v = catBtn.dataset.adFilterCategory;
    assetDashState.category = assetDashState.category === v ? '' : v;
    assetDashState.pageSize = 50;
    renderAssetsDashboard();
    return;
  }
  const clearOne = target.closest('[data-ad-clear-filter]');
  if (clearOne) {
    const k = clearOne.dataset.adClearFilter;
    assetDashState[k] = typeof assetDashState[k] === 'boolean' ? false : '';
    assetDashState.pageSize = 50;
    renderAssetsDashboard();
    return;
  }
  if (target.closest('[data-ad-clear-all]')) {
    assetDashState.search = ''; assetDashState.station = ''; assetDashState.category = '';
    assetDashState.status = ''; assetDashState.maker = '';
    assetDashState.staleOnly = false; assetDashState.infraAlertsOnly = false; assetDashState.qualityFilter = '';
    assetDashState.pageSize = 50;
    renderAssetsDashboard();
    return;
  }
  const tabBtn = target.closest('[data-ad-tab]');
  if (tabBtn) {
    assetDashState.tab = tabBtn.dataset.adTab;
    renderAssetsDashboard();
    return;
  }
  const sortBtn = target.closest('[data-ad-sort]');
  if (sortBtn) {
    const col = sortBtn.dataset.adSort;
    if (assetDashState.sortBy === col) assetDashState.sortDir = assetDashState.sortDir === 'asc' ? 'desc' : 'asc';
    else { assetDashState.sortBy = col; assetDashState.sortDir = 'asc'; }
    renderAssetsDashboard();
    return;
  }
  if (target.closest('[data-ad-more]')) {
    assetDashState.pageSize += 50;
    renderAssetsDashboard();
    return;
  }
  const row = target.closest('[data-ad-asset-idx]');
  if (row) { adOpenAssetDetail(Number(row.dataset.adAssetIdx)); return; }
  if (target.id === 'ad-asset-dialog' && typeof target.close === 'function') { target.close(); return; }
  if (target.closest('[data-ad-close-dialog]')) { document.getElementById('ad-asset-dialog')?.close(); return; }
  const filterClose = target.closest('[data-ad-filter-station-close]');
  if (filterClose) {
    document.getElementById('ad-asset-dialog')?.close();
    assetDashState.station = filterClose.dataset.adFilterStationClose;
    renderAssetsDashboard();
    return;
  }
  const openInsp = target.closest('[data-ad-open-insp]');
  if (openInsp) {
    document.getElementById('ad-asset-dialog')?.close();
    if (typeof googleInspectionAssets === 'function') googleInspectionAssets(openInsp.dataset.adOpenInsp);
  }
});
