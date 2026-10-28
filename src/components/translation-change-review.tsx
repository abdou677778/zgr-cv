import { createContext, useContext, type ReactNode } from "react";
import type { CV } from "@/lib/cv-types";
import { DOCUMENT_LANGUAGES } from "@/lib/document-language";
import { rowChronology, reversedChronology, type Chronology } from "@/lib/cv-chronology";

const Context = createContext<{
  cv?: CV;
  acknowledge?: (path: string) => void;
  readOnly?: boolean;
}>({});
const fieldNames: Record<string, string> = {
  experiences: "Expérience",
  formations: "Formation",
  educations: "Étude",
  titre: "Titre",
  dates: "Dates",
  date: "Date",
  lieu: "Lieu",
  employeur: "Employeur",
  institution: "Établissement",
  descriptions: "Réalisations",
  competences: "Compétences",
  objectif: "Objectif",
  nom_complet: "Nom",
  telephone: "Téléphone",
  email: "E-mail",
  adresse: "Adresse",
  lettre_motivation: "Lettre",
  objet: "Objet",
  paragraphes: "Paragraphes",
  plan_developpement: "Plan professionnel",
  langues: "Langues",
  logiciels: "Logiciels",
  custom_sections: "Sections personnalisées",
  option: "Option",
  equivalence: "Équivalence",
};
const fieldName = (path: string) =>
  path
    .split(".")
    .filter((_, index, parts) => !(parts.length === 3 && index === 1))
    .map((part) => fieldNames[part] ?? part)
    .join(" — ");
export function TranslationChangesProvider({
  cv,
  onAcknowledge,
  readOnly = false,
  children,
}: {
  cv: CV;
  onAcknowledge: (path: string) => void;
  readOnly?: boolean;
  children: ReactNode;
}) {
  return (
    <Context.Provider value={{ cv, acknowledge: onAcknowledge, readOnly }}>
      {children}
    </Context.Provider>
  );
}
export function usePendingTranslation() {
  const { cv } = useContext(Context);
  return (path: string) =>
    Object.keys(cv?.pending_translations ?? {}).some(
      (key) => key === path || key.startsWith(`${path}.`),
    );
}
function targetValue(cv: CV, path: string): unknown {
  const [section, key, field] = path.split(".");
  if (["experiences", "formations", "educations"].includes(section)) {
    const rows = cv[section as "experiences"];
    const row = rows.find((item) => item.id === key);
    return field ? (row as unknown as Record<string, unknown>)?.[field] : row;
  }
  const value = cv[section as keyof CV];
  return key && value && typeof value === "object"
    ? (value as Record<string, unknown>)[key]
    : value;
}
export function TranslationChangeNotice({ prefix }: { prefix?: string }) {
  const { cv, acknowledge, readOnly } = useContext(Context);
  if (!cv) return null;
  const entries = Object.entries(cv.pending_translations ?? {}).filter(
    ([key]) => !prefix || key === prefix || key.startsWith(`${prefix}.`),
  );
  if (!entries.length) return null;
  return (
    <section
      aria-label={
        prefix ? "Champs à traduire de cet élément" : "Modifications linguistiques à vérifier"
      }
      className="my-3 space-y-2 rounded-xl border border-red-300 bg-red-50 p-3 text-xs text-red-950"
    >
      <h4 className="font-bold">{entries.length} champ(s) à traduire ou à vérifier</h4>
      <p>
        Le rouge concerne uniquement le formulaire. Les traductions existantes sont conservées ; une
        proposition source n’est pas une traduction validée.
      </p>
      <details open={!!prefix}>
        <summary>Comparer les modifications</summary>
        {entries.map(([path, change]) => (
          <div
            key={path}
            data-testid="translation-change"
            data-change-path={path}
            className="my-2 rounded-lg border border-red-200 bg-red-100/70 p-2"
          >
            <p className="font-semibold">
              {fieldName(path)} —{" "}
              {change.kind === "added"
                ? "Ajout à traduire"
                : change.kind === "deleted"
                  ? "Suppression à confirmer"
                  : "Modification à intégrer"}{" "}
              depuis {DOCUMENT_LANGUAGES.find((item) => item.id === change.source_language)?.name}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                Valeur actuelle
                <pre className="max-h-32 overflow-auto whitespace-pre-wrap">
                  {JSON.stringify(targetValue(cv, path), null, 2)}
                </pre>
              </div>
              <div>
                Nouvelle valeur source
                <pre className="max-h-32 overflow-auto whitespace-pre-wrap">
                  {JSON.stringify(change.source_value, null, 2)}
                </pre>
              </div>
            </div>
            <button
              type="button"
              disabled={readOnly}
              className="mt-2 rounded border border-red-300 bg-white p-1"
              onClick={() => {
                if (readOnly) return;
                if (
                  change.kind === "deleted" &&
                  !confirm("Supprimer cet élément dans cette langue après contrôle ?")
                )
                  return;
                acknowledge?.(path);
              }}
            >
              {change.kind === "deleted"
                ? "Confirmer la suppression dans cette langue"
                : "J’ai vérifié la traduction de ce champ"}
            </button>
          </div>
        ))}
      </details>
    </section>
  );
}

export function ChronologyNotice({
  row,
}: {
  row: { chronology?: Chronology; dates?: string; date?: string };
}) {
  const chronology = rowChronology(row);
  const text = row.dates ?? row.date ?? "";
  const ambiguous = /\b\d{1,2}\/\d{1,2}\/\d{4}\b/.test(text);
  const reversed = reversedChronology(chronology);
  return (
    <p
      className={`text-xs ${ambiguous || reversed || !chronology.start ? "text-amber-800" : "text-slate-500"}`}
    >
      {reversed
        ? "Dates incohérentes : la fin précède le début. À corriger."
        : ambiguous
          ? "Date numérique ambiguë : utilisez AAAA-MM-JJ pour confirmer le jour et le mois."
          : !chronology.start
            ? "Date absente ou non reconnue : élément placé après les dates connues. Utilisez AAAA ou AAAA-MM."
            : "Classement automatique : du plus récent au plus ancien. Les dates en cours passent en premier."}
    </p>
  );
}
