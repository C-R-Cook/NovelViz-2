/** Inline in root layout `<head>` so saved dev palette applies before paint (non-production only). */
export const DEV_PALETTE_HYDRATION_SCRIPT =
  process.env.NODE_ENV !== "production"
    ? `(function(){try{var k="dev_palette";var ids=["midnight","gothic","candlelight","moonlight","crimson"];var classes=["","palette-gothic","palette-candlelight","palette-moonlight","palette-crimson"];var p=localStorage.getItem(k);var i=ids.indexOf(p);if(i>0&&classes[i])document.body.classList.add(classes[i]);}catch(e){}})();`
    : "";
