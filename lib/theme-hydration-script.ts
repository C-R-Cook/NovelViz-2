/**
 * Inline before paint so saved `nv_theme` (or legacy `dev_palette`) matches SSR shell.
 * Keep in sync with `lib/theme-preference.ts` migration rules.
 */
export const THEME_HYDRATION_SCRIPT = `(function(){try{
var SK="nv_theme";
var LK="dev_palette";
var V=["candle-light","aged-parchment"];
function norm(p){
  if(!p)return"candle-light";
  if(p==="aged-parchment")return"aged-parchment";
  if(p==="candle-light")return"candle-light";
  var D=["moonlight-silver","deep-ocean","forest-dusk","antiquarian","midnight","moonlight","gothic","crimson","candlelight"];
  if(D.indexOf(p)>=0)return"candle-light";
  return"candle-light";
}
var id="candle-light";
var s=localStorage.getItem(SK);
if(s&&V.indexOf(s)>=0)id=s;
else if(s)id=norm(s);
else{var leg=localStorage.getItem(LK);if(leg)id=norm(leg);}
document.documentElement.setAttribute("data-theme",id);
localStorage.setItem(SK,id);
}catch(e){}})();`;
