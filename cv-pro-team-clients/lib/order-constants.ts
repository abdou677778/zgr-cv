export const serviceIds = [
  'CV_EUROPASS',
  'CV_CANADIEN',
  'CV_ATS',
  'CV_ARABE',
  'LETTRE_FR',
  'LETTRE_ENG',
  'CONSEILS',
] as const;

export const fileCategoryIds = [
  'ANCIEN_CV',
  'DIPLOMES_CERTIFICATS',
  'PHOTOS',
  'DOCUMENTS_PROFESSIONNELS',
  'AUTRES',
] as const;

export const serviceLabels: Record<(typeof serviceIds)[number], string> = {
  CV_EUROPASS: 'CV Europass',
  CV_CANADIEN: 'CV Canadien',
  CV_ATS: 'CV ATS',
  CV_ARABE: 'CV Arabe',
  LETTRE_FR: 'Lettre FR',
  LETTRE_ENG: 'Lettre ENG',
  CONSEILS: 'Conseils',
};

export const fileCategoryLabels: Record<
  (typeof fileCategoryIds)[number],
  string
> = {
  ANCIEN_CV: 'Ancien CV',
  DIPLOMES_CERTIFICATS: 'Diplômes et certificats',
  PHOTOS: 'Photos',
  DOCUMENTS_PROFESSIONNELS: 'Documents professionnels',
  AUTRES: 'Autres documents',
};

export type ServiceId = (typeof serviceIds)[number];
export type FileCategoryId = (typeof fileCategoryIds)[number];
