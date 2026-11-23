// Configuração pública: nunca incluir chaves individuais ou senhas.
window.VOANET_SYNC_CONFIG = {
  mode: 'google',
  google: {
    endpoint: 'https://script.google.com/macros/s/AKfycbyiG91xRVftgcZm2P0CZt891spudljfGEqauyE7EZLcO5V9tq1rqrAOurMrSDbbcPHh6w/exec',
    assetWorkbook: 'https://docs.google.com/spreadsheets/d/1WArVbYwKaiWkhgNxeNXdbPx4OK5tNqyJcDRbFp91Gf8/edit',
    assetTabs: {
      inventory: 139638130,
      batteries: 921753183,
      climate: 1214011406,
      rectifiers: 2116867713
    }
  },
  fleet: {
    endpoint: 'https://script.google.com/macros/s/AKfycbzu_Y5wYdPSMFwGsvokHAM_iVxOF0SH52mzNW9QBKJjnmHn_Tyo1ir4mS3hfv11F_sOAw/exec'
  }
};
