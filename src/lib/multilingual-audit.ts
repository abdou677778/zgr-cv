/** Structural coverage, not a claim that a machine can certify every translation. */
export const CV_LANGUAGES = ["fr", "en", "es", "de", "it", "zh", "ar"] as const;
type RecordValue = Record<string, unknown>;
const object = (value: unknown): RecordValue =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as RecordValue) : {};
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const populated = (value: unknown): boolean =>
  typeof value === "string" ? !!value.trim() : Array.isArray(value) ? value.some(populated) : false;

export function auditMultilingualDocuments(value: unknown, requireAllLanguages = true) {
  const documents = object(value);
  const present = CV_LANGUAGES.filter(
    (language) => Object.keys(object(documents[language])).length,
  );
  const errors: string[] = [];
  const warnings: string[] = [];
  if (requireAllLanguages)
    for (const language of present) {
      for (const section of ["logiciels", "custom_sections"])
        if (!Array.isArray(object(documents[language])[section]))
          errors.push(
            `documents.${language}.${section} : tableau obligatoire (utiliser [] si aucune donnée attestée)`,
          );
    }
  if (requireAllLanguages)
    for (const language of CV_LANGUAGES)
      if (!present.includes(language)) errors.push(`documents.${language} : langue manquante`);
  const fields = [
    "titre_poste",
    "objectif",
    "candidature",
    "statut_relocation",
    "plan_developpement",
    "competences",
    "participations",
    "certifications",
    "interets",
    "references",
  ];
  const checkCoverage = (values: unknown[], path: string[]) => {
    if (values.some(populated))
      values.forEach((entry, index) => {
        if (!populated(entry))
          errors.push(`${path[index]} : contenu présent dans une autre langue mais vide ici`);
      });
  };
  for (const field of fields) {
    const values = present.map((language) => object(documents[language])[field]);
    checkCoverage(
      values,
      present.map((language) => `documents.${language}.${field}`),
    );
    if (field !== "plan_developpement" && values.some(Array.isArray)) {
      const max = Math.max(...values.map((value) => list(value).length));
      values.forEach((value, index) => {
        if (list(value).length !== max)
          errors.push(`documents.${present[index]}.${field} : éléments manquants`);
      });
    }
  }
  for (const field of ["objet", "salutation", "paragraphes", "formule_politesse"])
    checkCoverage(
      present.map((language) => object(object(documents[language]).lettre_motivation)[field]),
      present.map((language) => `documents.${language}.lettre_motivation.${field}`),
    );
  const paragraphs = present.map((language) =>
    list(object(object(documents[language]).lettre_motivation).paragraphes),
  );
  const paragraphCount = Math.max(0, ...paragraphs.map((items) => items.length));
  paragraphs.forEach((items, index) => {
    if (items.length !== paragraphCount)
      errors.push(
        `documents.${present[index]}.lettre_motivation.paragraphes : paragraphes manquants`,
      );
  });
  for (const field of ["fr", "en", "ar", "de", "es", "kab"])
    checkCoverage(
      present.map((language) => object(object(documents[language]).langues)[field]),
      present.map((language) => `documents.${language}.langues.${field}`),
    );
  const sections: Record<string, string[]> = {
    experiences: ["titre", "employeur", "lieu", "dates", "descriptions"],
    formations: ["titre", "institution", "lieu", "date", "competences"],
    educations: ["titre", "institution", "lieu", "date", "option", "equivalence"],
    logiciels: ["label", "icon"],
    custom_sections: ["title", "items"],
  };
  for (const [section, properties] of Object.entries(sections)) {
    const arrays = present.map((language) => list(object(documents[language])[section]));
    arrays.forEach((items, index) => {
      const ids = items.map((item) => object(item).id);
      if (
        ids.some((id) => typeof id !== "string" || !id.trim()) ||
        new Set(ids).size !== ids.length
      )
        errors.push(`documents.${present[index]}.${section} : identifiants absents ou dupliqués`);
    });
    const longest = Math.max(0, ...arrays.map((items) => items.length));
    arrays.forEach((items, index) => {
      if (items.length !== longest)
        errors.push(
          `documents.${present[index]}.${section} : ${items.length}/${longest} éléments, section incomplète`,
        );
    });
    for (let index = 0; index < longest; index++) {
      const entries = arrays.map((items) => object(items[index]));
      entries.forEach((entry, languageIndex) => {
        if (!properties.some((property) => populated(entry[property])))
          errors.push(
            `documents.${present[languageIndex]}.${section}[${index}] : entrée vide artificielle`,
          );
      });
      const ids = entries.map((item) => (typeof item.id === "string" ? item.id : ""));
      if (ids.some(Boolean) && ids.some((id) => id !== ids.find(Boolean)))
        errors.push(`${section}[${index}].id : identifiants ou ordre différents entre les langues`);
      for (const property of properties) {
        const values = entries.map((item) => item[property]);
        checkCoverage(
          values,
          present.map((language) => `documents.${language}.${section}[${index}].${property}`),
        );
        if (values.some(Array.isArray)) {
          const max = Math.max(...values.map((value) => list(value).length));
          values.forEach((value, languageIndex) => {
            if (list(value).length !== max)
              errors.push(
                `documents.${present[languageIndex]}.${section}[${index}].${property} : puces manquantes`,
              );
          });
          values.forEach((value, languageIndex) => {
            if (list(value).some((item) => typeof item !== "string" || !item.trim()))
              errors.push(
                `documents.${present[languageIndex]}.${section}[${index}].${property} : puce vide ou invalide`,
              );
          });
        }
      }
      if (section === "logiciels" && entries.some((item) => !populated(item.label)))
        errors.push(`logiciels[${index}].label : nom de produit vide`);
      if (section === "logiciels" && entries.some((item) => !populated(item.icon)))
        errors.push(
          `logiciels[${index}].icon : identifiant de logo vide (utiliser generic si inconnu)`,
        );
      if (section === "logiciels" && new Set(entries.map((item) => item.icon)).size > 1)
        errors.push(`logiciels[${index}].icon : identifiants de logo différents entre les langues`);
      if (section === "custom_sections")
        entries.forEach((entry, languageIndex) => {
          if (!populated(entry.title))
            errors.push(
              `documents.${present[languageIndex]}.custom_sections[${index}].title : titre vide`,
            );
          const title = typeof entry.title === "string" ? entry.title : "";
          if (
            ((present[languageIndex] === "ar" && !/\p{Script=Arabic}/u.test(title)) ||
              (present[languageIndex] === "zh" && !/\p{Script=Han}/u.test(title))) &&
            /[a-z]{4}/i.test(title)
          )
            warnings.push(
              `documents.${present[languageIndex]}.custom_sections[${index}].title : vérifier la traduction du titre (sauf nom propre)`,
            );
        });
    }
  }
  return {
    errors: [...new Set(errors)],
    warnings: [...new Set(warnings)],
    presentLanguages: present,
    semanticReviewRequired: true,
  };
}
