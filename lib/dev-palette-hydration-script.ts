/** Inline in root layout `<head>` so saved dev theme applies before paint (non-production only). */
export const DEV_PALETTE_HYDRATION_SCRIPT =
  process.env.NODE_ENV !== "production"
    ? `(function(){try{
var k="dev_palette";
var valid=["moonlight-silver","candle-light","deep-ocean","aged-parchment","forest-dusk","antiquarian"];
var migrate={midnight:"moonlight-silver",gothic:"forest-dusk",candlelight:"candle-light",moonlight:"moonlight-silver",crimson:"antiquarian"};
var p=localStorage.getItem(k);
var id="moonlight-silver";
if(p){
  if(valid.indexOf(p)>=0) id=p;
  else if(migrate[p]) id=migrate[p];
}
document.documentElement.setAttribute("data-theme",id);
localStorage.setItem(k,id);
}catch(e){}})();`
    : "";
