// lib/preview-merge.ts
import type { CVJson } from "./cvSchema";

// Normalize random preview field names into our CVJson education item
function mapPreviewEduItem(it: any) {
  const bullets =
    it?.details || it?.summary || it?.bullets || it?.lines || it?.items || [];
  const toBulletObjs = (arr: any) =>
    (Array.isArray(arr) ? arr : [arr])
      .filter(Boolean)
      .map((x) => (typeof x === "string" ? { text: x } : x))
      .filter((x) => x && typeof x.text === "string" && x.text.trim().length);

  const start =
    it?.startDate || it?.start || it?.from || it?.periodStart || it?.dateStart;
  const end =
    it?.endDate || it?.end || it?.to || it?.periodEnd || it?.dateEnd;

  return {
    school:
      it?.school ||
      it?.institution ||
      it?.university ||
      it?.name ||
      it?.org ||
      "",
    degree: it?.degree || it?.qualification || it?.title || "",
    fieldOfStudy:
      it?.fieldOfStudy ||
      it?.field ||
      it?.area ||
      it?.major ||
      it?.specialization ||
      "",
    eqfLevel: it?.eqfLevel || it?.eqf || it?.levelEqf || it?.eqf_level || "",
    location: it?.location || it?.city || "",
    startDate: start || "",
    endDate: end || "",
    details: toBulletObjs(bullets),
  };
}

// Copy Education from preview model → cv.education (authoritative)
export function syncEducationFromPreview(cv: CVJson, previewModel: any): CVJson {
  const src =
    previewModel?.candidate?.education ||
    previewModel?.education ||
    previewModel?.candidate?.educationHistory ||
    [];

  const mapped = (Array.isArray(src) ? src : [src])
    .filter(Boolean)
    .map(mapPreviewEduItem)
    // keep only items with at least a school or degree or a detail
    .filter(
      (e) =>
        (e.school && e.school.trim().length) ||
        (e.degree && e.degree.trim().length) ||
        (e.details && e.details.length)
    );

  if (!mapped.length) return cv;

  const next: CVJson = {
    ...cv,
    education: mapped,
    meta: Object.assign(
      {},
      cv.meta || {},
      {
        // breadcrumb for debugging
        flags: {
          ...((cv.meta as any)?.flags || {}),
          educationSyncedFromPreview: true,
        },
      }
    ) as any,
  };

  return next;
}
