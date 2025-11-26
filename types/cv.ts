import type { CvData as BaseCvData } from "../lib/cv-view";

export type CvData = BaseCvData & {
  candidate: BaseCvData["candidate"] & {
    links?: { url: string; label?: string | null }[] | null;
    about?: string | null;
    [key: string]: any; // allow extra fields used by templates
  };
  [key: string]: any; // allow any extra top-level fields if needed
};
