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
        <p>${manager ? 'Acompanhe as vistorias, ativos, SLA dos POPs, frota e levantamentos FTTx.' : 'Registre suas vistorias de campo (inclusive offline) e acompanhe seus envios.'}</p>
        <div class="overview-account"><strong>${manager ? 'Gestão' : 'Operação'}</strong><span>${esc(googleUser.email)}</span></div>
      </header>
      <section id="overview-onboarding" class="overview-section overview-onboarding" aria-label="${manager ? 'Governança e ações rápidas' : 'Guia rápido de início'}"></section>
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
    const onboarding = document.getElementById('overview-onboarding');
    if (onboarding) {
      const pendingAssetsTotal = googleCentralItems.reduce((sum, item) => sum + (Number(item.assets?.pending) || 0), 0);
      if (manager) {
        onboarding.innerHTML = `<div class="overview-gov-bar">
          <div>
            <h2>Governança e ações rápidas</h2>
            <p class="small muted">Acesso de Gestão auditado · chaves individuais revogáveis · periodicidade automática (45d Alta/Crítica, 90d Média).</p>
          </div>
          <div class="btnrow">
            <a class="btn tiny primary" href="./?modulo=ativos" data-module="ativos">Abrir Dashboard de Ativos</a>
            <a class="btn tiny" href="./?modulo=inspecoes&visao=pendencias" data-module="inspecoes" data-inspection-view="pendencias">Pendências de ativos${pendingAssetsTotal > 0 ? ` (${pendingAssetsTotal})` : ''}</a>
            <a class="btn tiny" href="./?modulo=fttx" data-module="fttx">Novo FTTx</a>
            <a class="btn tiny" href="./?modulo=inspecoes&visao=acessos" data-module="inspecoes" data-inspection-view="acessos">Gerenciar acessos e chaves</a>
          </div>
        </div>`;
      } else {
        const drafts = records.filter(record => !record.finalizedAt).length;
        onboarding.innerHTML = `<div class="overview-guide-card">
          <div class="overview-section-heading">
            <div>
              <h2>Comece por aqui · Vistoria em campo</h2>
              <p class="small muted">Seus rascunhos e fotos ficam salvos no aparelho mesmo sem internet e sincronizam assim que a conexão voltar.</p>
            </div>
            <a class="btn primary" href="./?modulo=inspecoes&visao=nova" data-module="inspecoes" data-inspection-view="nova">＋ Iniciar nova inspeção</a>
          </div>
          <ol class="overview-steps-list">
            <li><strong>1. Selecione o POP</strong><span>Escolha a estação cadastrada para preencher periodicidade e pré-carregar ativos.</span></li>
            <li><strong>2. Revise inventário e checklist</strong><span>Confirme etiquetas, marque C/NC/NA e anexe foto nas não conformidades.</span></li>
            <li><strong>3. Finalize e sincronize</strong><span>Finalize na aba Resumo para gerar o PDF e atualizar a base central.${drafts ? ` (${drafts} rascunho(s) aberto(s))` : ''}</span></li>
          </ol>
        </div>`;
      }
    }
    const slaBox = document.getElementById('overview-sla');
    if (slaBox && manager) {
      const activeStations = (typeof googleStations !== 'undefined' ? googleStations : []).filter(s => !s.inactive && !s.swap && !s.duplicate && !/\bSWAP\b/i.test(String(s.name || '') + ' ' + String(s.code || '')));
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
    } else if (target === 'pendencias') {
      if (typeof googleHistoryPendingOnly !== 'undefined') googleHistoryPendingOnly = true;
      openGoogleCentral('history');
    } else if (target === 'cronograma' && (view !== 'googleCentral' || googleCentralSection !== 'schedule')) {
      openGoogleCentral('schedule');
    } else if (target === 'acessos' && googleUser.role === 'GESTAO') {
      if (typeof googleIssuedKey !== 'undefined') googleIssuedKey = null;
      view = 'googleAccess';
      render();
      if (typeof googleLoadAccess === 'function') googleLoadAccess();
    } else if (target === 'nova') {
      if (typeof blank === 'function' && typeof records !== 'undefined') {
        const fresh = blank();
        records.unshift(fresh);
        activeId = fresh.id;
        view = 'identificacao';
        if (typeof saveAll === 'function') saveAll();
        render();
      }
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
      try { fleetFrame?.contentWindow?.postMessage({ type: 'voanet-theme', theme: next }, location.origin); } catch (_) {}
      syncThemeButton();
    });
  }

  // Guia rápido contextual (Novatos & Gestores) + Atalhos de acessibilidade
  const helpBtn = document.getElementById('portal-help-btn');
  const helpDialog = document.getElementById('portal-help-dialog');
  function openPortalHelp() {
    if (!helpDialog || typeof helpDialog.showModal !== 'function') return;
    const manager = googleUser?.role === 'GESTAO';
    const logged = Boolean(googleUser);
    helpDialog.innerHTML = `<div class="ad-dialog-head">
      <div><h3 id="portal-help-title">Guia Rápido & Governança · VOANET</h3>
        <span class="small muted">${logged ? (manager ? 'Perfil Gestão · Acesso administrativo e auditoria' : 'Perfil Operação · Campo e envios') : 'Orientações de acesso'}</span></div>
      <button type="button" class="btn tiny" data-portal-help-close>Fechar (Esc)</button>
    </div>
    <div class="ad-dialog-body">
      ${!logged ? `<section><h4>Como acessar pela primeira vez</h4>
        <p class="small">Peça sua <strong>chave individual</strong> ao gestor de infraestrutura. Cada acesso é vinculado ao seu e-mail corporativo e pode ser revogado a qualquer momento sem perder o histórico.</p></section>` : ''}
      ${!logged || !manager ? `<section><h4>Passo a passo para Operadores (Campo)</h4>
        <ol class="portal-help-list">
          <li><strong>Escolha o POP cadastrado:</strong> o sistema define automaticamente a periodicidade e pré-carrega os equipamentos já registrados na base central.</li>
          <li><strong>Use a legenda do checklist:</strong> <code>C</code> Conforme · <code>NC</code> Não conforme (exige observação) · <code>NA</code> Não se aplica · <code>NV</code> Não verificado.</li>
          <li><strong>Funciona offline:</strong> rascunhos e fotos ficam salvos no celular/navegador e sobem automaticamente quando houver conexão.</li>
        </ol></section>` : ''}
      ${manager ? `<section><h4>Rotina recomendada para Gestores</h4>
        <ol class="portal-help-list">
          <li><strong>Central + Radar de SLA:</strong> acompanhe POPs vencidos (45d Alta/Crítica, 90d Média) e estações sem vistoria.</li>
          <li><strong>Dashboard de Ativos:</strong> filtre por POP, categoria, status, nº de série ou patrimônio; clique nos gráficos para cruzar filtros e baixe o <strong>PDF Executivo</strong> ou envie o <strong>resumo por e-mail</strong>.</li>
          <li><strong>Governança de Acessos e Auditoria:</strong> em <em>Gerenciar acessos</em>, emita/revogue chaves de operadores. Todas as alterações e trocas de ativos ficam registradas em <code>Historico_Ativos_POPs</code>.</li>
          <li><strong>Levantamento FTTx:</strong> importe KML/KMZ do OZmap, valide orçamento óptico GPON/XGS-PON e exporte a lista com 92 referências de preço atualizadas diariamente.</li>
        </ol></section>` : ''}
      <section><h4>Acessibilidade e atalhos de teclado</h4>
        <ul class="portal-help-list">
          <li><kbd>/</kbd> ou <kbd>Ctrl</kbd>+<kbd>K</kbd>: foca a busca rápida na tela atual (Ativos, Histórico ou FTTx).</li>
          <li><kbd>Alt</kbd>+<kbd>1</kbd>.. <kbd>Alt</kbd>+<kbd>5</kbd>: alterna entre os módulos disponíveis na barra superior.</li>
          <li><kbd>?</kbd>: abre este guia rápido em qualquer tela.</li>
          <li><kbd>Esc</kbd>: fecha modais e retorna o foco.</li>
        </ul>
      </section>
    </div>`;
    helpDialog.showModal();
  }
  helpBtn?.addEventListener?.('click', openPortalHelp);
  helpDialog?.addEventListener?.('click', event => {
    if (event.target === helpDialog || event.target.closest?.('[data-portal-help-close]')) helpDialog.close();
  });
  document.addEventListener?.('keydown', event => {
    const tag = event.target?.tagName;
    const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || event.target?.isContentEditable;
    if ((event.ctrlKey || event.metaKey) && String(event.key).toLowerCase() === 'k') {
      const searchEl = document.getElementById('ad-search-input') || document.getElementById('google-history-search') || document.getElementById('fttx-search');
      if (searchEl && !searchEl.closest('[hidden]')) {
        event.preventDefault();
        searchEl.focus();
        searchEl.select?.();
      }
      return;
    }
    if (typing) return;
    if (event.key === '/') {
      const searchEl = document.getElementById('ad-search-input') || document.getElementById('google-history-search') || document.getElementById('fttx-search');
      if (searchEl && !searchEl.closest('[hidden]')) {
        event.preventDefault();
        searchEl.focus();
      }
      return;
    }
    if (event.key === '?') {
      event.preventDefault();
      openPortalHelp();
      return;
    }
    if (event.altKey && /^[1-6]$/.test(event.key) && isGoogleMode() && googleUser) {
      const visibleLinks = [...(navigation?.querySelectorAll?.('a[data-module]') || [])].filter(a => !a.hidden);
      const chosen = visibleLinks[Number(event.key) - 1];
      if (chosen) {
        event.preventDefault();
        openModule(chosen.dataset.module);
      }
    }
  });

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
