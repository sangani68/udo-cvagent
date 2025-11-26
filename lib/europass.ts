// lib/europass.ts
export type EuropassJson = {
  personal?: {
    firstName?: string;
    lastName?: string;
    address?: string;
    city?: string;
    country?: string;
    phone?: string;
    email?: string;
    dateOfBirth?: string;
    nationality?: string;
    gender?: string;
    photoDataUrl?: string;
  };
  summary?: string;
  links?: { label: string; url: string }[];
  work?: Array<{
    start?: string;
    end?: string;
    title?: string;
    employer?: string;
    city?: string;
    country?: string;
    bullets?: string[];
    description?: string;
  }>;
  education?: Array<{
    start?: string;
    end?: string;
    degree?: string;
    institution?: string;
    city?: string;
    country?: string;
    bullets?: string[];
    description?: string;
  }>;
  skills?: {
    communication?: string[];
    organisation?: string[];
    jobRelated?: string[];
    digital?: string[];
    other?: string[];
  };
  languages?: {
    motherTongue?: string[];
    other?: Array<{
      language: string;
      levelCEFR?: string;
      listening?: string;
      reading?: string;
      spokenInteraction?: string;
      spokenProduction?: string;
      writing?: string;
    }>;
  };
};
