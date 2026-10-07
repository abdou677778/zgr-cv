import {
  BadgeCheck,
  BriefcaseBusiness,
  ExternalLink,
  FileUp,
  Globe2,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";

import { Button } from "@/components/ui/button";

type OpportunitiesLanguage = "fr" | "ar";
type DirectoryKind = "canada" | "gulf";
type AccessLevel = "jobs" | "cv" | "contact";

type DirectoryEntry = {
  id: string;
  name: string;
  url: string;
  license?: string;
  access: AccessLevel;
  recommended?: boolean;
  summaryFr: string;
  summaryAr: string;
  noteFr: string;
  noteAr: string;
};

const CNESST_REGISTRY_URL =
  "https://www.cnesst.gouv.qc.ca/fr/demarches-formulaires/agences-placement-personnel-recrutement/permis-agences/registre-titulaires-permis-agence";
const CNESST_WORKER_RIGHTS_URL =
  "https://www.cnesst.gouv.qc.ca/fr/demarches-formulaires/agences-placement-personnel-recrutement/agences-recrutement-travailleurs-etrangers/obligations-agences-recrutement-travailleurs";

const CANADA_ENTRIES: DirectoryEntry[] = [
  {
    id: "immijob",
    name: "Immijob",
    url: "https://immijob.com/candidats-trouver-un-emploi-au-canada/",
    license: "AR-2101518",
    access: "jobs",
    recommended: true,
    summaryFr: "Offres ouvertes aux talents étrangers et dépôt gratuit du CV.",
    summaryAr: "عروض موجهة للمواهب الأجنبية مع نشر السيرة الذاتية مجانا.",
    noteFr:
      "Accessible depuis tout pays selon sa FAQ; l’admissibilité au permis est analysée séparément.",
    noteAr: "تذكر صفحة الأسئلة أنه متاح من أي بلد، مع تقييم منفصل لأهلية تصريح العمل.",
  },
  {
    id: "phoenix-gmi",
    name: "PHOENIX-GMI",
    url: "https://phoenixgmi.com/espace-candidats-et-emploi/",
    license: "AR-2000004",
    access: "jobs",
    recommended: true,
    summaryFr: "Catalogue d’offres pour candidats étrangers avec candidature sur chaque fiche.",
    summaryAr: "قائمة وظائف للمرشحين الأجانب مع التقديم من صفحة كل عرض.",
    noteFr:
      "Le site demande de postuler uniquement par son formulaire et publie une alerte antifraude.",
    noteAr: "يشترط الموقع التقديم عبر استمارته فقط وينشر تحذيرا من انتحال هويته.",
  },
  {
    id: "dr-recrutement",
    name: "DR Recrutement International",
    url: "https://www.drrecrutementinternational.com/offres-d-emploi",
    license: "AR-2000505",
    access: "jobs",
    recommended: true,
    summaryFr:
      "Offres et formulaires dans le transport, la mécanique, l’industrie, l’hôtellerie et la santé.",
    summaryAr: "عروض واستمارات في النقل والميكانيك والصناعة والفندقة والصحة.",
    noteFr:
      "Les candidatures doivent passer par la section Offres d’emploi, pas par courriel ou téléphone.",
    noteAr: "يجب إرسال الطلب عبر قسم الوظائف، وليس بالبريد الإلكتروني أو الهاتف.",
  },
  {
    id: "also",
    name: "Also Recrutement",
    url: "https://www.alsorecrutement.com/deposez-votre-cv/",
    license: "AR-2303213",
    access: "cv",
    summaryFr: "Dépôt direct d’un CV pour le recrutement local ou international.",
    summaryAr: "إيداع مباشر للسيرة الذاتية للتوظيف المحلي أو الدولي.",
    noteFr:
      "Un dépôt de CV n’est pas une offre d’emploi et ne garantit pas une réponse d’un employeur.",
    noteAr: "إيداع السيرة الذاتية ليس عرض عمل ولا يضمن جوابا من صاحب عمل.",
  },
  {
    id: "moi",
    name: "Main d’Œuvre Internationale (MOI)",
    url: "https://moi-recrutement.com/emploi/",
    license: "AR-2403945",
    access: "cv",
    summaryFr: "Formulaire de candidature spontanée avec CV pour profils internationaux.",
    summaryAr: "استمارة ترشح تلقائي مع السيرة الذاتية للملفات الدولية.",
    noteFr:
      "Le site n’affichait aucun poste disponible lors de l’audit; utiliser le formulaire comme candidature spontanée.",
    noteAr: "لم يكن الموقع يعرض وظائف شاغرة وقت التدقيق؛ الاستمارة مخصصة للترشح التلقائي.",
  },
  {
    id: "rha",
    name: "RHA International",
    url: "https://www.rhainternational.ca/",
    license: "AR-2202165",
    access: "contact",
    summaryFr: "Mise en relation avec des employeurs selon les compétences du candidat.",
    summaryAr: "ربط المرشح بأصحاب عمل وفقا لمهاراته.",
    noteFr:
      "L’ancienne page CANDIDATS fournie est supprimée; utiliser uniquement l’accueil actuel et son formulaire.",
    noteAr:
      "صفحة المرشحين القديمة المحالة لم تعد موجودة؛ استخدم الصفحة الرئيسية الحالية واستمارتها فقط.",
  },
  {
    id: "ambition-canada",
    name: "Ambition Canada International",
    url: "https://www.ambitioncanadainternational.com/",
    license: "AR-2303510",
    access: "contact",
    summaryFr: "Agence de recrutement de travailleurs étrangers avec formulaire de contact.",
    summaryAr: "وكالة لتوظيف العمال الأجانب مع استمارة اتصال.",
    noteFr:
      "Aucun catalogue candidat n’est exposé: demander si un mandat réel correspond au métier avant tout document sensible.",
    noteAr:
      "لا توجد قائمة وظائف للمرشحين؛ تحقق من وجود تكليف حقيقي يناسب مهنتك قبل إرسال وثائق حساسة.",
  },
  {
    id: "csf",
    name: "Carrières Sans Frontières",
    url: "https://csf.ong/individus/",
    license: "AR-2000114",
    access: "contact",
    summaryFr:
      "Services individuels et recrutement international; ce n’est pas un tableau d’offres.",
    summaryAr: "خدمات للأفراد وتوظيف دولي، وليس لوحة عروض عمل.",
    noteFr: "Vérifier le service, son coût éventuel et le mandat employeur avant de poursuivre.",
    noteAr: "تحقق من طبيعة الخدمة وتكلفتها المحتملة ووجود تكليف من صاحب عمل قبل المتابعة.",
  },
];

const GULF_ENTRIES: DirectoryEntry[] = [
  {
    id: "gulftalent",
    name: "GulfTalent",
    url: "https://www.gulftalent.com/",
    access: "jobs",
    recommended: true,
    summaryFr:
      "Plateforme d’emploi couvrant notamment les Émirats, l’Arabie saoudite, le Qatar, Oman, Bahreïn et le Koweït.",
    summaryAr: "منصة وظائف تشمل خصوصا الإمارات والسعودية وقطر وعمان والبحرين والكويت.",
    noteFr:
      "Ce n’est pas une agence publique. Contrôler l’employeur, le contrat, le visa et le canal de candidature dans chaque annonce.",
    noteAr: "ليست وكالة حكومية. تحقق في كل إعلان من صاحب العمل والعقد والتأشيرة ومسار التقديم.",
  },
  {
    id: "soundlines",
    name: "Soundlines Group",
    url: "https://soundlinesgroup.com/apply-for-a-job/",
    access: "contact",
    summaryFr: "Formulaire générique de dépôt des coordonnées pour une éventuelle vacance.",
    summaryAr: "استمارة عامة لإيداع بيانات الاتصال من أجل وظيفة محتملة.",
    noteFr:
      "Le formulaire ne confirme ni une offre précise ni l’acceptation automatique d’un candidat tunisien ou algérien.",
    noteAr: "لا تؤكد الاستمارة وجود عرض محدد ولا القبول الآلي لمرشح تونسي أو جزائري.",
  },
];

function accessText(access: AccessLevel, language: OpportunitiesLanguage) {
  const values: Record<AccessLevel, { fr: string; ar: string }> = {
    jobs: { fr: "Offres + candidature", ar: "عروض وتقديم" },
    cv: { fr: "Dépôt de CV", ar: "إيداع السيرة" },
    contact: { fr: "Contact préalable", ar: "اتصال أولي" },
  };
  return values[access][language];
}

function AccessIcon({ access }: { access: AccessLevel }) {
  if (access === "jobs") return <BriefcaseBusiness className="h-4 w-4" />;
  if (access === "cv") return <FileUp className="h-4 w-4" />;
  return <Globe2 className="h-4 w-4" />;
}

export function RecruitmentDirectoriesPanel({
  kind,
  language,
}: {
  kind: DirectoryKind;
  language: OpportunitiesLanguage;
}) {
  const ar = language === "ar";
  const entries = kind === "canada" ? CANADA_ENTRIES : GULF_ENTRIES;

  return (
    <>
      <div className="flex-1 overflow-y-auto p-3 sm:p-5" dir={ar ? "rtl" : "ltr"}>
        <div className="mx-auto max-w-7xl space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="max-w-4xl">
                <p className="text-xs font-black uppercase tracking-wide text-red-700">
                  {kind === "canada"
                    ? ar
                      ? "كندا · وكالات ومنصات دولية"
                      : "Canada · agences et plateformes internationales"
                    : ar
                      ? "دول الخليج · منصات توظيف"
                      : "Pays du Golfe · plateformes de recrutement"}
                </p>
                <h2 className="mt-1 text-xl font-black text-slate-950">
                  {kind === "canada"
                    ? ar
                      ? "دليل التقديم للمرشح من الجزائر أو تونس"
                      : "Annuaire candidat depuis l’Algérie ou la Tunisie"
                    : ar
                      ? "وظائف الخليج: تحقق قبل إرسال الملف"
                      : "Emplois du Golfe : vérifier avant d’envoyer le dossier"}
                </h2>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  {kind === "canada"
                    ? ar
                      ? "تم فحص الوصول ومسار المرشح ورقم التصريح الذي ينشره كل موقع. الرقم المنشور ليس ضمانا للتوظيف ويجب التحقق من حالته الحالية في السجل الرسمي قبل كل إجراء."
                      : "Accès, parcours candidat et numéro de permis publié ont été contrôlés. Un numéro affiché ne garantit aucune embauche et son statut doit être revérifié dans le registre officiel avant chaque démarche."
                    : ar
                      ? "هذه الروابط متاحة للبحث أو إيداع البيانات، لكنها لا تضمن عقدا ولا تأشيرة ولا قبول المرشحين من كل جنسية."
                      : "Ces accès permettent de rechercher ou déposer un profil, sans garantir contrat, visa ni acceptation de toutes les nationalités."}
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-black text-emerald-900">
                <BadgeCheck className="h-4 w-4" />
                {ar ? "دُقق في 7 أكتوبر 2026" : "Audité le 7 octobre 2026"}
              </span>
            </div>
          </section>

          {kind === "canada" ? (
            <section className="grid gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
                <p className="leading-6">
                  {ar
                    ? "تعرض البطاقات رقم التصريح كما نشره الموقع. افتح سجل CNESST واكتب الرقم للتأكد من أن الحالة «صالحة» وأن الفئة تشمل توظيف العمال الأجانب المؤقتين."
                    : "Les cartes reprennent le permis déclaré par le site. Ouvrez le registre CNESST, recherchez ce numéro et confirmez un statut « Valide » dans la catégorie recrutement de travailleurs étrangers temporaires."}
                </p>
              </div>
              <Button asChild size="sm" className="bg-blue-800 text-white hover:bg-blue-900">
                <a href={CNESST_REGISTRY_URL} target="_blank" rel="noreferrer">
                  {ar ? "فتح سجل CNESST" : "Contrôler dans le registre CNESST"}
                  <ExternalLink className="ms-2 h-4 w-4" />
                </a>
              </Button>
            </section>
          ) : null}

          <div className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
            {entries.map((entry) => (
              <article
                key={entry.id}
                className="flex min-h-full flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-black text-slate-950">{entry.name}</h3>
                    <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-700">
                      <AccessIcon access={entry.access} /> {accessText(entry.access, language)}
                    </span>
                  </div>
                  {entry.recommended ? (
                    <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-black uppercase text-emerald-900">
                      {ar ? "مسار مباشر" : "Parcours direct"}
                    </span>
                  ) : null}
                </div>

                <p className="mt-3 text-sm font-semibold leading-6 text-slate-800">
                  {ar ? entry.summaryAr : entry.summaryFr}
                </p>
                <p className="mt-2 text-xs leading-5 text-slate-600">
                  {ar ? entry.noteAr : entry.noteFr}
                </p>

                {entry.license ? (
                  <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-950">
                    <span className="font-black">
                      {ar ? "رقم تصريح CNESST المعلن:" : "Permis CNESST déclaré :"}
                    </span>{" "}
                    <span dir="ltr" className="font-mono font-bold">
                      {entry.license}
                    </span>
                  </div>
                ) : null}

                <Button
                  asChild
                  size="sm"
                  variant={entry.recommended ? "default" : "outline"}
                  className={`mt-4 w-full ${
                    entry.recommended ? "bg-red-700 text-white hover:bg-red-800" : ""
                  }`}
                >
                  <a href={entry.url} target="_blank" rel="noreferrer">
                    {entry.access === "jobs"
                      ? ar
                        ? "عرض الوظائف والتقديم"
                        : "Voir les offres et postuler"
                      : entry.access === "cv"
                        ? ar
                          ? "فتح نموذج السيرة الذاتية"
                          : "Ouvrir le dépôt de CV"
                        : ar
                          ? "فتح الموقع للتحقق"
                          : "Ouvrir le site et vérifier"}
                    <ExternalLink className="ms-2 h-4 w-4" />
                  </a>
                </Button>
              </article>
            ))}
          </div>

          <section className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="leading-6">
              <p className="font-black">{ar ? "حماية من الاحتيال" : "Protection antifraude"}</p>
              <p>
                {ar
                  ? "لا توجد بطاقة في هذا الدليل تضمن وظيفة أو تأشيرة. لا تدفع مقابل عرض مضمون، ولا ترسل جواز السفر أو بيانات البنك قبل التحقق من الشركة والعقد والقناة الرسمية."
                  : "Aucune fiche de cet annuaire ne garantit emploi ou visa. Ne payez jamais pour une offre garantie et n’envoyez passeport ou données bancaires qu’après contrôle de l’entreprise, du contrat et du canal officiel."}
              </p>
              {kind === "canada" ? (
                <a
                  href={CNESST_WORKER_RIGHTS_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-1 font-black text-amber-950 underline"
                >
                  {ar
                    ? "حقوق العامل وقواعد الوكالات"
                    : "Droits du travailleur et obligations des agences"}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : null}
            </div>
          </section>

          <p className="text-xs leading-5 text-slate-500">
            {kind === "canada"
              ? ar
                ? "لم تُعرض الروابط القديمة أو غير الموثوقة كفرص نشطة: BRH القديم، IMRECAN، صفحة Groupe SFP المقدمة وصفحة Agence Portfolio المقدمة."
                : "Liens anciens ou non fiables non promus comme opportunités actives : ancien accès BRH, IMRECAN, page Groupe SFP fournie et page Agence Portfolio fournie."
              : ar
                ? "لم يتم إدراج Wazifu لأن صفحة التسجيل المقدمة ترجع خطأ 404."
                : "Wazifu n’est pas intégré : la page d’inscription fournie renvoie une erreur 404."}
          </p>
        </div>
      </div>
      <footer className="border-t border-slate-200 bg-white px-5 py-3 text-xs text-slate-500">
        {ar
          ? "ZGR يعرض مسارات التقديم ولا يرسل الطلبات آليا ولا يحفظ بيانات الدخول."
          : "ZGR référence les parcours; il ne postule pas automatiquement et ne conserve aucun identifiant."}
      </footer>
    </>
  );
}
