import fs from "fs";

const p = "components/gallery/gallery-image-comments.tsx";
let s = fs.readFileSync(p, "utf8");

const headerOld = `      <div className="gallery-section-label-row">
        <motion className="gallery-section-label-text">
          <span className="gallery-section-label" id={headingId}>
            Comments
          </span>
        </motion>
        <motion className="gallery-section-label-line" aria-hidden />
      </motion>

      <motion className="mt-4 space-y-3">`;
