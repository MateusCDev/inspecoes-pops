'use strict';

(() => {
  const app = document.getElementById('app');
  const fleetPane = document.getElementById('portal-fleet-pane');
  const fleetStatus = document.getElementById('portal-fleet-status');
  const fttxPane = document.getElementById('portal-fttx-pane');
  const fttxLink = document.querySelector('[data-module="fttx"]');
  const navigation = document.querySelector('.portal-tabs');
  const signOut = document.getElementById('portal-signout');
  const currentScript = new URL(document.currentScript.src);
  const version = currentScript.searchParams.get('v');
  const fleetUrl = new URL('./frota/', currentScript);
  let activeModule;
  let fleetFrame;
  let inspectionsScroll = 0;
  let fttxScroll = 0;

  function moduleFromLocation() {
    const module = new URL(location.href).searchParams.get('modulo');
    return ['frota','fttx'].includes(module) ? module : 'inspecoes';
  }

  function vehicleHash() {
    return location.hash.startsWith('#veiculo=') ? location.hash : '';
  }

  function showModule(module) {
    const changed = activeModule !== module;
    if (changed && activeModule === 'inspecoes') inspectionsScroll = window.scrollY;
    if (changed && activeModule === 'fttx') fttxScroll = window.scrollY;
    activeModule = module;
    const showFleet = module === 'frota' && Boolean(googleUser);
    const showFttx = module === 'fttx' && Boolean(googleUser);
    app.hidden = showFleet || showFttx;
    fleetPane.hidden = !showFleet;
    fttxPane.hidden = !showFttx;
    fttxLink.hidden = googleUser?.role !== 'GESTAO';
    signOut.hidden = !googleUser;
    document.body.dataset.portalModule = showFleet || showFttx ? module : 'inspecoes';
    for (const link of navigation.querySelectorAll('[data-module]')) {
      if (link.dataset.module === module) link.setAttribute('aria-current','page');
      else link.removeAttribute('aria-current');
    }
    if (showFleet && googleUser.role !== 'GESTAO') {
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
    if (showFttx && googleUser.role !== 'GESTAO') {
      fttxPane.innerHTML = '<p class="portal-module-status" role="status">O Levantamento FTTx está disponível para o perfil Gestão.</p>';
    } else if (showFttx && !fttxPane.hasChildNodes()) {
      mountFttx(fttxPane);
    }
    if (changed) window.scrollTo(0,showFttx ? fttxScroll : showFleet ? 0 : inspectionsScroll);
  }

  function openModule(module) {
    if (module === activeModule) return;
    const url = new URL(location.href);
    if (module === 'frota' || module === 'fttx') url.searchParams.set('modulo',module);
    else url.searchParams.delete('modulo');
    url.hash = '';
    history.pushState(null,'',url);
    showModule(module);
  }

  document.querySelector('.portal-header').addEventListener('click',event => {
    const link = event.target.closest('[data-module]');
    if (!link || event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || !isGoogleMode()) return;
    event.preventDefault();
    openModule(link.dataset.module);
  });
  window.addEventListener('popstate',() => showModule(moduleFromLocation()));
  signOut.addEventListener('click',googleLogout);

  window.VOANET_PORTAL = Object.freeze({
    refresh() {
      if (!googleUser) {
        fleetFrame?.remove();
        fleetFrame = null;
        fleetStatus.hidden = true;
        fttxPane.replaceChildren();
        inspectionsScroll = 0;
        fttxScroll = 0;
      }
      showModule(moduleFromLocation());
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
