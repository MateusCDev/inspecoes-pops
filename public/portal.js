'use strict';

(() => {
  const app = document.getElementById('app');
  const overview = document.getElementById('portal-overview');
  const fleetPane = document.getElementById('portal-fleet-pane');
  const fleetStatus = document.getElementById('portal-fleet-status');
  const fttxPane = document.getElementById('portal-fttx-pane');
  const navigation = document.querySelector('.portal-tabs');
  const brand = document.querySelector('.portal-brand');
  const signOut = document.getElementById('portal-signout');
  const currentScript = new URL(document.currentScript.src);
  const version = currentScript.searchParams.get('v');
  const fleetUrl = new URL('./frota/', currentScript);
  const modules = {
    inspecoes: ['Inspeções POPs', 'Registre vistorias, consulte relatórios e trate pendências por estação.'],
    frota: ['Frota', 'Acompanhe veículos, checklists e movimentações.'],
    fttx: ['Levantamento FTTx', 'Estime materiais e custos de rede e exporte a lista para o almoxarifado.']
  };
  const scrollPositions = {};
  let activeModule;
  let fleetFrame;

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
        <div class="overview-modules">${(manager ? Object.keys(modules) : ['inspecoes']).map(overviewModule).join('')}</div>
      </section>
      <section class="overview-section overview-activity" aria-labelledby="overview-activity-title">
        <div class="overview-section-heading">
          <h2 id="overview-activity-title">Atividade de inspeções</h2>
          <button class="btn tiny" type="button" data-action="googleRefresh" id="overview-update">Atualizar dados</button>
        </div>
        <div id="overview-stats" class="overview-stats"></div>
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
    const showFleet = module === 'frota' && signedIn;
    const showFttx = module === 'fttx' && signedIn;
    const manager = googleUser?.role === 'GESTAO';
    app.hidden = showOverview || showFleet || showFttx;
    overview.hidden = !showOverview;
    fleetPane.hidden = !showFleet;
    fttxPane.hidden = !showFttx;
    signOut.hidden = !signedIn;
    navigation.hidden = isGoogleMode() && !signedIn;
    brand.dataset.module = isGoogleMode() ? 'central' : 'inspecoes';
    document.body.dataset.portalModule = app.hidden ? module : 'inspecoes';
    for (const link of navigation.querySelectorAll('[data-module]')) {
      const target = link.dataset.module;
      link.hidden = !isGoogleMode() ? target !== 'inspecoes' : ['frota','fttx'].includes(target) && !manager;
      if (target === module) link.setAttribute('aria-current','page');
      else link.removeAttribute('aria-current');
    }
    if (showOverview) {
      if (!overview.hasChildNodes()) mountOverview();
      updateOverview();
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

  window.VOANET_PORTAL = Object.freeze({
    updateOverview,
    refresh() {
      if (!googleUser) {
        fleetFrame?.remove();
        fleetFrame = null;
        fleetStatus.hidden = true;
        fttxPane.replaceChildren();
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
