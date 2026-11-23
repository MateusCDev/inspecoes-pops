// Configuração pública: nunca incluir chaves individuais ou senhas.
window.VOANET_SYNC_CONFIG = {
  mode: 'google',
  google: {
    endpoint: 'https://script.google.com/macros/s/AKfycbwDdoCYFpr301-AI0p-KLJ_SQziTyaJJ4l812v8ZR0yaQDAIHvPWYYy51i-jtN9_skO/exec',
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
