// Gera a alternativa de arquivo único a partir dos mesmos fontes testados.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, 'apps-script', name), 'utf8');
const source = `// Integração POPs — arquivo único para o Bd.gs do projeto existente.
// Substitui somente o conteúdo anterior de Bd.gs desta integração.
// Não é necessário criar schema.gs separado nesta alternativa.
// Antes de implantar, verificar se outro arquivo já declara doPost.
// Se existir, integrar o encaminhamento na função existente em vez de duplicá-la.
const BdInspecoesPOPs = (() => {
'use strict';
${read('schema.gs')}
${read('Code.gs')}
const REPORT_LOGO = '${fs.readFileSync(path.join(root, 'public', 'voanet.png')).toString('base64')}';
${read('report.gs')}
${read('access.gs')}
${read('scheduling.gs')}
${read('runtime.gs')}
${read('staging.gs')}
${read('jobs.gs')}
${read('dashboard.gs')}
${read('assets.gs')}
${read('access-admin.gs')}
${read('fleet.gs')}
${read('link-catalog.gs')}
return { setup, setupFleet, createOperatorKey, doPost, processQueue };
})();

function prepararInspecoesPOPs() {
  return BdInspecoesPOPs.setup();
}

function prepararFrota() {
  return BdInspecoesPOPs.setupFleet();
}

function criarChaveInspecoesPOPs() {
  return BdInspecoesPOPs.createOperatorKey();
}

function processarFilaInspecoesPOPs() {
  return BdInspecoesPOPs.processQueue();
}

function receberInspecoesPOPs(e) {
  return BdInspecoesPOPs.doPost(e);
}

// Este é o ponto de entrada do aplicativo Web. O projeto deve ter somente um doPost.
function doPost(e) {
  return receberInspecoesPOPs(e);
}
`;
fs.writeFileSync(path.join(root, 'apps-script', 'Bd.gs'), source);
