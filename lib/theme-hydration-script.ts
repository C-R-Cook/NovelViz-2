/**
 * Inline before-paint script so saved `nv_theme` (or legacy `dev_palette`) matches the SSR shell.
 * Keep in sync with `lib/theme-preference.ts` migration rules.
 *
 * Valid themes: candle-light (default), moonlight-silver.
 * aged-parchment is a legacy value → normalises to candle-light.
 */
export const THEME_HYDRATION_SCRIPT = `(function(){try{
var SK="nv_theme";
var LK="dev_palette";
var V=["candle-light","moonlight-silver"];
function norm(p){
  if(!p)return"candle-light";
  if(p==="candle-light")return"candle-light";
  if(p==="moonlight-silver")return"moonlight-silver";
  // aged-parchment removed; legacy dark themes all map to candle-light
  return"candle-light";
}
var path=window.location.pathname;
var id="candle-light";
if(path==="/"||path===""){
  id="candle-light";
}else{
var s=localStorage.getItem(SK);
if(s&&V.indexOf(s)>=0)id=s;
else if(s)id=norm(s);
else{var leg=localStorage.getItem(LK);if(leg)id=norm(leg);}
}
document.documentElement.setAttribute("data-theme",id);
if(path!=="/"&&path!==""){localStorage.setItem(SK,id);}
}catch(e){}})();`;
