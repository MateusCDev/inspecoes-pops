'use strict';

(() => {
  const app = document.getElementById('app');
  const overview = document.getElementById('portal-overview');
  const fleetPane = document.getElementById('portal-fleet-pane');
  const fleetStatus = document.getElementById('portal-fleet-status');
  const assetsPane = document.getElementById('portal-assets-pane');
  const fttxPane = document.getElementById('portal-fttx-pane');
  const fibraPane = document.getElementById('portal-fibra-pane');
  const navigation = document.querySelector('.portal-tabs');
  const brand = document.querySelector('.portal-brand');
  const signOut = document.getElementById('portal-signout');
  const currentScript = new URL(document.currentScript.src);
  const version = currentScript.searchParams.get('v');
  const fleetUrl = new URL('./frota/', currentScript);
  const modules = {
    inspecoes: ['Inspeções POPs', 'Registre vistorias, consulte relatórios e trate pendências por estação.'],
    ativos: ['Ativos', 'Acompanhe saúde operacional, ranking de POPs críticos, séries e patrimônios.'],
    frota: ['Frota', 'Acompanhe veículos, checklists e movimentações.'],
    fttx: ['Levantamento FTTx', 'Estime materiais e custos de rede e exporte a lista para o almoxarifado.'],
    fibra: ['Fibra Import', 'Prepare arquivos KML e KMZ para importação no OZmap.']
  };
  const scrollPositions = {};
  let activeModule;
  let fleetFrame;
  let fibraFrame;

  function moduleFromLocation() {
    const module = new URL(location.href).searchParams.get('modulo');
    if (Object.hasOwn(modules, module)) return module;
    return isGoogleMode() ? 'central' : 'inspecoes';
  }

  function vehicleHash() {
    return location.hash.startsWith('#veiculo=') ? location.hash : '';
  }

  function overviewModule(module) {
    const [title, description] = modules[module];
    return `<a class="overview-module" href="./?modulo=${module}" data-module="${module}">
      <span class="overview-module-icon overview-icon-${module}" aria-hidden="true"></span>
      <span><strong>${title}</strong><span class="overview-module-detail">${description}</span></span>
      <span class="overview-module-arrow" aria-hidden="true">→</span>
    </a>`;
  }

  function mountOverview() {
    const manager = googleUser.role === 'GESTAO';
    overview.innerHTML = `<div class="overview-shell">
      <header class="overview-hero">
        <h1 id="overview-title" tabindex="-1">Central de Infraestrutura</h1>
        <p>${manager ? 'Acompanhe as vistorias, a frota e os levantamentos da equipe.' : 'Acesse suas vistorias de campo e acompanhe os envios.'}</p>
        <div class="overview-account"><strong>${manager ? 'Gestão' : 'Operação'}</strong><span>${esc(googleUser.email)}</span></div>
      </header>
      <section class="overview-section" aria-labelledby="overview-modules-title">
        <h2 id="overview-modules-title">Módulos</h2>
        <div class="overview-modules">${(manager ? Object.keys(modules) : ['inspecoes','fibra']).map(overviewModule).join('')}</div>
      </section>
      <section class="overview-section overview-activity" aria-labelledby="overview-activity-title">
        <div class="overview-section-heading">
          <h2 id="overview-activity-title">Atividade de inspeções</h2>
          <button class="btn tiny" type="button" data-action="googleRefresh" id="overview-update">Atualizar dados</button>
        </div>
        <div id="overview-stats" class="overview-stats"></div>
        ${manager ? '<div id="overview-sla" class="overview-sla"></div>' : ''}
        <div class="overview-recent">
          <div class="overview-section-heading">
            <h3>${manager ? 'Inspeções recebidas' : 'Meus envios'}</h3>
            <a class="overview-history-link" href="./?modulo=inspecoes&visao=historico" data-module="inspecoes" data-inspection-view="historico">Abrir histórico →</a>
          </div>
          <div id="overview-recent-items"></div>
        </div>
      </section>
    </div>`;
  }

  function updateOverview() {
    if (overview.hidden || !googleUser) return;
    const stats = document.getElementById('overview-stats');
    const recent = document.getElementById('overview-recent-items');
    if (!stats || !recent) return;
    const refreshButton = document.getElementById('overview-update');
    refreshButton.disabled = googleCentralBusy;
    refreshButton.textContent = googleCentralBusy ? 'Atualizando…' : 'Atualizar dados';
    const manager = googleUser.role === 'GESTAO';
    const localPending = records.filter(record => record.finalizedAt && !['sincronizado','processando'].includes(record.syncState)).length;
    const total = googleSummary?.total ?? (googleCentralUpdated ? googleCentralItems.length : null);
    const nonconformities = googleSummary?.nc ?? (googleCentralUpdated
      ? googleCentralItems.reduce((sum,item) => sum+(Number(item.nc)||0),0) : null);
    const metrics = [
      [manager ? 'Inspeções recebidas' : 'Minhas inspeções enviadas', total],
      manager ? ['Não conformidades', nonconformities] : ['Rascunhos neste aparelho', records.filter(record=>!record.finalizedAt).length],
      ['Envios pendentes neste aparelho', localPending, localPending>0]
    ];
    stats.innerHTML = metrics.map(([label,value,link])=>`<div><strong>${esc(value ?? '—')}</strong><span>${label}</span>
      ${link ? '<a class="overview-history-link" href="./?modulo=inspecoes&visao=envios" data-module="inspecoes" data-inspection-view="envios">Ver envios</a>' : ''}
      </div>`).join('');
    const slaBox = document.getElementById('overview-sla');
    if (slaBox && manager) {
      const activeStations = (typeof googleStations !== 'undefined' ? googleStations : []).filter(s => !s.inactive && !s.duplicate);
      const upcoming = typeof googleUpcomingInspections === 'function' ? googleUpcomingInspections(googleCentralItems) : [];
      const byCode = new Map(upcoming.map(item => [String(item.stationCode || ''), item]));
      const overdue = [], dueSoon = [], never = [], current = [];
      for (const st of activeStations) {
        const last = byCode.get(st.code);
        if (!last) { never.push(st); continue; }
        const days = typeof daysUntil === 'function' ? daysUntil(last.due) : null;
        if (days !== null && days < 0) overdue.push({ ...st, due: last.due, elapsed: Math.abs(days) });
        else if (days !== null && days <= 7) dueSoon.push({ ...st, due: last.due, days });
        else current.push({ ...st, due: last.due, days });
      }
      overdue.sort((a, b) => b.elapsed - a.elapsed);
      dueSoon.sort((a, b) => a.days - b.days);
      const urgent = [
        ...overdue.slice(0, 4).map(x => ({ name: x.name, code: x.code, cls: 'overdue', badge: `Vencida há ${x.elapsed}d` })),
        ...dueSoon.slice(0, 2).map(x => ({ name: x.name, code: x.code, cls: 'soon', badge: x.days === 0 ? 'Vence hoje' : `Vence em ${x.days}d` })),
        ...never.slice(0, 2).map(x => ({ name: x.name, code: x.code, cls: 'never', badge: 'Sem vistoria' }))
      ].slice(0, 6);
      slaBox.innerHTML = activeStations.length ? `<div class="overview-sla-head">
          <h3>Radar de SLA por POP</h3>
          <a class="overview-history-link" href="./?modulo=inspecoes&visao=cronograma" data-module="inspecoes" data-inspection-view="cronograma">Abrir cronograma →</a>
        </div>
        <div class="overview-sla-grid">
          <div class="sla-pill sla-overdue"><strong>${overdue.length}</strong><span>Vencidos</span></div>
          <div class="sla-pill sla-soon"><strong>${dueSoon.length}</strong><span>Até 7 dias</span></div>
          <div class="sla-pill sla-never"><strong>${never.length}</strong><span>Sem vistoria</span></div>
          <div class="sla-pill sla-ok"><strong>${current.length}</strong><span>Em dia</span></div>
        </div>
        ${urgent.length ? `<ul class="overview-sla-list">${urgent.map(u => `<li>
          <span><strong>${esc(u.name)}</strong> <small class="muted">${esc(u.code)}</small></span>
          <span class="sla-tag sla-tag-${u.cls}">${esc(u.badge)}</span>
        </li>`).join('')}</ul>` : '<p class="small muted">Todos os POPs cadastrados estão em dia.</p>'}` : '';
    }
    const rows = googleCentralItems.slice(0,3);
    recent.innerHTML = `<p class="small muted overview-source" role="status">${esc(googleCentralStatus())}</p>
      ${rows.length ? `<ul class="overview-recent-list">${rows.map(item=>`<li>
        <span><strong>${esc(item.station || 'Estação sem nome')}</strong>
        <small>${esc(fmt(item.date))}${item.technician ? ' · '+esc(item.technician) : ''}</small></span>
        ${manager&&Number(item.assets?.pending)>0 ? `<button class="btn tiny" type="button" data-action="googleIssues:${esc(item.id)}">Ver pendências (${Number(item.assets.pending)})</button>` : ''}
      </li>`).join('')}</ul>` : googleCentralUpdated ? '<p class="overview-empty">Nenhuma inspeção sincronizada para este perfil.</p>' : ''}`;
  }

  function showModule(module) {
    const changed = activeModule !== module;
    if (changed && activeModule) scrollPositions[activeModule] = window.scrollY;
    activeModule = module;
    const signedIn = Boolean(googleUser);
    const showOverview = module === 'central' && signedIn;
    const showAssets = module === 'ativos' && signedIn;
    const showFleet = module === 'frota' && signedIn;
    const showFttx = module === 'fttx' && signedIn;
    const showFibra = module === 'fibra' && signedIn;
    const manager = googleUser?.role === 'GESTAO';
    app.hidden = showOverview || showAssets || showFleet || showFttx || showFibra;
    overview.hidden = !showOverview;
    if (assetsPane) assetsPane.hidden = !showAssets;
    fleetPane.hidden = !showFleet;
    fttxPane.hidden = !showFttx;
    fibraPane.hidden = !showFibra;
    signOut.hidden = !signedIn;
    navigation.hidden = isGoogleMode() && !signedIn;
    brand.dataset.module = isGoogleMode() ? 'central' : 'inspecoes';
    document.body.dataset.portalModule = app.hidden ? module : 'inspecoes';
    for (const link of navigation.querySelectorAll('[data-module]')) {
      const target = link.dataset.module;
      link.hidden = !isGoogleMode() ? target !== 'inspecoes' : ['ativos','frota','fttx'].includes(target) && !manager;
      if (target === module) link.setAttribute('aria-current','page');
      else link.removeAttribute('aria-current');
    }
    if (showOverview) {
      if (!overview.hasChildNodes()) mountOverview();
      updateOverview();
    }
    if (showAssets && assetsPane) {
      if (!manager) {
        assetsPane.innerHTML = '<p class="portal-module-status" role="status">O Dashboard de Ativos está disponível apenas para o perfil Gestão.</p>';
      } else if (typeof mountAssetsDashboard === 'function') {
        mountAssetsDashboard();
      }
    }
    if (showFleet && !manager) {
      fleetStatus.hidden = false;
      fleetStatus.textContent = 'A Frota está disponível apenas para o perfil Gestão.';
    } else if (showFleet && !fleetFrame) {
      fleetStatus.hidden = true;
      fleetFrame = document.createElement('iframe');
      fleetFrame.className = 'portal-fleet-frame';
      fleetFrame.title = 'Frota Infra';
      const src = new URL(fleetUrl);
      if (version) src.searchParams.set('v',version);
      src.hash = vehicleHash();
      fleetFrame.src = src.href;
      fleetPane.append(fleetFrame);
    } else if (showFleet && vehicleHash() && fleetFrame?.contentWindow?.location.hash !== vehicleHash()) {
      fleetFrame.contentWindow.location.replace(vehicleHash());
    }
    if (showFttx && !manager) {
      fttxPane.innerHTML = '<p class="portal-module-status" role="status">O Levantamento FTTx está disponível para o perfil Gestão.</p>';
    } else if (showFttx && !fttxPane.hasChildNodes()) {
      mountFttx(fttxPane);
    }
    if (showFibra && !fibraFrame) {
      fibraFrame = document.createElement('iframe');
      fibraFrame.className = 'portal-fibra-frame';
      fibraFrame.title = 'Fibra Import — preparação de KML e KMZ';
      fibraFrame.src = new URL('../fibra-import/', location.origin + '/').href;
      fibraPane.append(fibraFrame);
    }
    if (changed) {
      window.scrollTo(0,scrollPositions[module] || 0);
      document.title = 'VOANET | '+(signedIn && modules[module] ? modules[module][0] : 'Central de Infraestrutura');
    }
  }

  function applyLocation() {
    const module = moduleFromLocation();
    showModule(module);
    if (!googleUser || module !== 'inspecoes') return;
    const target = new URL(location.href).searchParams.get('visao');
    if (target === 'historico' && (view !== 'googleCentral' || googleCentralSection !== 'history')) {
      openGoogleCentral('history');
    } else if (target === 'cronograma' && (view !== 'googleCentral' || googleCentralSection !== 'schedule')) {
      openGoogleCentral('schedule');
    } else if (target === 'envios') {
      if (view !== 'home') navigate('home');
      document.getElementById('sync-section')?.scrollIntoView();
    }
  }

  function openModule(module,inspectionView) {
    if (module !== 'central' && !Object.hasOwn(modules,module)) return;
    const url = new URL(location.href);
    if (module === 'central') url.searchParams.delete('modulo');
    else url.searchParams.set('modulo',module);
    if (inspectionView) url.searchParams.set('visao',inspectionView);
    else url.searchParams.delete('visao');
    url.hash = '';
    if (url.href !== location.href) history.pushState(null,'',url);
    applyLocation();
  }

  document.addEventListener('click',event => {
    const link = event.target.closest('a[data-module]');
    if (!link || !link.closest('.portal-header, #portal-overview') || event.button !== 0 ||
      event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || !isGoogleMode()) return;
    event.preventDefault();
    openModule(link.dataset.module,link.dataset.inspectionView);
    if (link.closest('#portal-overview') && !link.dataset.inspectionView) {
      navigation.querySelector('[aria-current="page"]')?.focus({preventScroll:true});
    }
  });
  window.addEventListener('popstate',applyLocation);
  signOut.addEventListener('click',googleLogout);
  const themeBtn = document.getElementById('portal-theme-toggle');
  function syncThemeButton() {
    if (!themeBtn) return;
    const isDark = document.documentElement?.dataset?.theme === 'dark';
    themeBtn.textContent = isDark ? '☀ Claro' : '☾ Escuro';
    themeBtn.setAttribute?.('aria-pressed', String(isDark));
  }
  if (themeBtn) {
    syncThemeButton();
    themeBtn.addEventListener?.('click', () => {
      const next = document.documentElement?.dataset?.theme === 'dark' ? 'light' : 'dark';
      if (document.documentElement?.dataset) document.documentElement.dataset.theme = next;
      try { localStorage.setItem('voanet_theme', next); } catch (_) {}
      syncThemeButton();
    });
  }

  window.VOANET_PORTAL = Object.freeze({
    updateOverview,
    refresh() {
      if (!googleUser) {
        fleetFrame?.remove();
        fleetFrame = null;
        fleetStatus.hidden = true;
        assetsPane?.replaceChildren();
        if (typeof resetAssetsDashboard === 'function') resetAssetsDashboard();
        fttxPane.replaceChildren();
        fibraFrame?.remove();
        fibraFrame = null;
        overview.replaceChildren();
        for (const module of Object.keys(scrollPositions)) delete scrollPositions[module];
        activeModule = null;
      }
      applyLocation();
    },
    fleetSession(client) {
      if (client === fleetFrame?.contentWindow && googleUser?.role === 'GESTAO' && googleAccessKey) {
        return {key:googleAccessKey,email:googleUser.email};
      }
      return null;
    },
    fleetLogout(client) {
      if (client === fleetFrame?.contentWindow) googleLogout();
    }
  });
  window.VOANET_PORTAL.refresh();
})();
