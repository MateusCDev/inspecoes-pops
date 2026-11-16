// Adaptador de autenticação. Sem credenciais/segredos; credenciais de usuário NUNCA são coletadas pelo app.
(function(){
  'use strict';
  const cfg=()=>window.VOANET_SYNC_CONFIG||{};
  let client=null,account=null,ready=false;
  const available=()=>Boolean(window.VOANET_MSAL?.PublicClientApplication);
  const configured=()=>cfg().mode==='interno'&&Boolean(cfg().microsoft?.tenantId&&cfg().microsoft?.clientId&&cfg().microsoft?.apiScope&&cfg().microsoft?.redirectUri&&cfg().apiBaseUrl)&&available();
  async function initialize(){
    if(!configured())return false;
    if(ready)return true;
    const c=cfg().microsoft;
    client=new window.VOANET_MSAL.PublicClientApplication({auth:{clientId:c.clientId,authority:`https://login.microsoftonline.com/${c.tenantId}`,redirectUri:c.redirectUri,postLogoutRedirectUri:c.redirectUri},cache:{cacheLocation:'sessionStorage'}});
    await client.initialize();
    const result=await client.handleRedirectPromise();
    const accounts=client.getAllAccounts().filter(a=>a.tenantId?.toLowerCase()===c.tenantId.toLowerCase());
    account=result?.account&&accounts.find(a=>a.homeAccountId===result.account.homeAccountId)|| (accounts.length===1?accounts[0]:null);
    if(account)client.setActiveAccount(account);
    ready=true;return true;
  }
  function accounts(){return client?client.getAllAccounts().filter(a=>a.tenantId?.toLowerCase()===cfg().microsoft.tenantId.toLowerCase()):[]}
  function select(i){const a=accounts()[i];if(!a)throw Error('Conta não encontrada.');account=a;client.setActiveAccount(a);return a}
  async function login(){if(!await initialize())throw Error('Integração Microsoft ainda não configurada pelo TI.');await client.loginRedirect({scopes:[cfg().microsoft.apiScope],prompt:'select_account'});}
  async function logout(){if(!client||!account)return;await client.logoutRedirect({account});}
  async function token(){if(!ready||!account)throw Error('Entre com uma conta Microsoft autorizada.');try{return (await client.acquireTokenSilent({scopes:[cfg().microsoft.apiScope],account})).accessToken}catch(e){throw Error('Sua sessão precisa ser renovada. Use Entrar/Trocar conta e tente novamente.')}}
  function current(){return account}
  window.VOANET_ENTRA={available,configured,initialize,accounts,select,login,logout,token,current};
})();
