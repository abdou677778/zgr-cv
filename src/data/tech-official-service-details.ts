/** Editorial snapshot from provider pages checked on 29 October 2026.
 * No selling prices, supplier costs, invoice claims or subscription dates.
 * Exact plan-name matches only. Never infer a tier from a resale price.
 */
export const TECH_SERVICE_DETAILS_CHECKED = "29/10/2026";
type OfficialDetails = { name: string; websiteUrl: string; features: string[]; note?: string };
export const TECH_OFFICIAL_SERVICE_DETAILS: OfficialDetails[] = [
  {
    name: "Canva Pro",
    websiteUrl: "https://www.canva.com/fr_fr/tarification/",
    features: [
      "Création avec modèles et contenus premium.",
      "Redimensionnement, traduction et suppression d’arrière-plan.",
      "5 identités visuelles et programmation des publications.",
      "100 Go de stockage.",
    ],
    note: "Les outils IA ont leurs propres limites ; le Pass IA peut être payant.",
  },
  {
    name: "Canva Pro+",
    websiteUrl: "https://www.canva.com/fr_fr/tarification/",
    features: [
      "Fonctions Pro avec collaboration et administration d’équipe.",
      "100 identités visuelles et circuits de validation.",
      "Accès à Flourish et Affinity selon les conditions de Canva.",
      "500 Go de stockage.",
    ],
    note: "Pass IA et recharges éventuelles facturés séparément.",
  },
  {
    name: "Canva Pro Education",
    websiteUrl: "https://www.canva.com/education/",
    features: [
      "Modèles pédagogiques et nombreuses fonctions premium.",
      "Partage de devoirs et collaboration avec les élèves.",
      "Connexions aux plateformes éducatives compatibles.",
    ],
    note: "Canva Education est gratuit pour les publics scolaires éligibles, après vérification. Ce n’est pas une formule Pro commerciale ouverte à tous.",
  },
  {
    name: "Capcut Pro",
    websiteUrl: "https://www.capcut.com/pricing",
    features: [
      "Montage avec modèles et fonctions Pro premium.",
      "Accès aux outils IA avec 1 200 crédits mensuels.",
      "1 To de stockage.",
    ],
    note: "Les générations consomment des crédits ; promotions et modèles peuvent évoluer.",
  },
  {
    name: "Capcut Ultra",
    websiteUrl: "https://www.capcut.com/pricing",
    features: [
      "Fonctions Pro et outils IA exclusifs Ultra.",
      "8 645 crédits IA mensuels.",
      "Modèles premium et 1 To de stockage.",
    ],
    note: "Consommation variable selon les outils ; vérifier le quota du compte avant activation.",
  },
  {
    name: "ChatGPT Go",
    websiteUrl: "https://chatgpt.com/pricing/",
    features: [
      "Plus de messages avec outils et de fichiers qu’en accès gratuit.",
      "Davantage de créations d’images et de conversations vocales.",
      "Mémoire étendue.",
    ],
    note: "Limites d’usage applicables ; cette formule peut inclure des publicités.",
  },
  {
    name: "ChatGPT Plus",
    websiteUrl: "https://chatgpt.com/pricing/",
    features: [
      "Raisonnement avancé et recherche approfondie élargie.",
      "Création d’images, mémoire et fichiers avec limites étendues.",
      "Projets, tâches, GPT personnalisés et accès étendu à Codex.",
    ],
    note: "Les quotas dépendent des outils et peuvent évoluer.",
  },
  {
    name: "ChatGPT Business",
    websiteUrl: "https://chatgpt.com/pricing/",
    features: [
      "Espace de travail partagé pour équipes.",
      "Administration, facturation centralisée et sécurité de connexion.",
      "Données professionnelles non utilisées pour l’entraînement par défaut.",
    ],
    note: "Le type de licence et le nombre de sièges doivent être confirmés ; ne pas confondre Standard et Premium.",
  },
  {
    name: "ChatGPT Pro X5",
    websiteUrl: "https://help.openai.com/en/articles/9793128-about-chatgpt-pro-tiers",
    features: [
      "Fonctions Pro : raisonnement, recherche, images et fichiers.",
      "Accès à Codex avec capacités dépendant du niveau Pro.",
    ],
    note: "Le nom commercial X5 ne suffit pas à identifier le niveau Pro actuel : confirmer la licence et ses quotas dans le compte.",
  },
  {
    name: "ChatGPT Pro X20",
    websiteUrl: "https://help.openai.com/en/articles/9793128-about-chatgpt-pro-tiers",
    features: [
      "Fonctions Pro : raisonnement, recherche, images et fichiers.",
      "Accès à Codex avec capacités dépendant du niveau Pro.",
    ],
    note: "X20 n’identifie pas une formule actuelle dans la page officielle consultée. Confirmer le niveau réel avant de promettre un multiplicateur.",
  },
  {
    name: "Claude Pro",
    websiteUrl: "https://claude.com/pricing",
    features: [
      "Usage supérieur à l’offre gratuite.",
      "Claude Code, projets et accès à Research.",
      "Choix élargi de modèles et intégrations compatibles.",
    ],
    note: "Limites d’utilisation applicables ; fonctionnalités selon disponibilité.",
  },
  {
    name: "Claude Max",
    websiteUrl: "https://claude.com/pricing",
    features: [
      "Fonctions Pro avec limites de sortie supérieures.",
      "Priorité en période chargée.",
      "Accès anticipé à certaines nouveautés.",
    ],
    note: "Max existe en 5x et 20x : votre fiche ne précise pas lequel. Confirmer ce niveau avant de détailler les quotas.",
  },
  {
    name: "Duolingo Super",
    websiteUrl: "https://blog.duolingo.com/duolingo-101-how-to-learn-a-language-on-duolingo/",
    features: [
      "Apprentissage sans publicité entre les leçons.",
      "Vies illimitées et entraînements personnalisés.",
      "Révision des erreurs, écoute, expression et vocabulaire.",
    ],
    note: "Les fonctions IA de Duolingo Max ne sont pas incluses dans Super ; disponibilité selon le cours et l’application.",
  },
  {
    name: "Gemini Pro",
    websiteUrl: "https://one.google.com/about/google-ai-plans/",
    features: [
      "Google AI Pro : accès élargi à Gemini et Deep Research.",
      "Outils de création IA et aide dans les applications Google compatibles.",
      "Accès élargi au carnet de recherche Gemini Notebook.",
      "5 To de stockage Google Photos, Drive et Gmail.",
    ],
    note: "Avantages, quotas, âge requis et disponibilité varient selon le pays et le compte.",
  },
  {
    name: "HeyGen Creator",
    websiteUrl: "https://www.heygen.com/pricing",
    features: [
      "Création de vidéos avec avatars et voix personnalisés.",
      "Export 1080p sans marquage HeyGen.",
      "600 crédits ; prise en charge de plus de 175 langues et dialectes.",
      "Accès aux moteurs Avatar et à Video Agent selon leurs limites.",
    ],
    note: "Les fonctionnalités avancées consomment des crédits.",
  },
  {
    name: "HeyGen Pro",
    websiteUrl: "https://www.heygen.com/pricing",
    features: [
      "Fonctions Creator avec export jusqu’en 4K.",
      "1 000 crédits sur l’offre Pro de base affichée.",
      "Avatars cinématiques et accès élargi aux modèles vidéo.",
      "Traitement plus rapide et correction des scripts traduits.",
    ],
    note: "Le volume de crédits peut être ajusté ; vérifier la formule souscrite.",
  },
  {
    name: "Jenni Ai Plus",
    websiteUrl: "https://docs.jenni.ai/docs/account/plans-and-billing/",
    features: [
      "5 000 autocomplétions par mois.",
      "500 modifications IA et 500 messages IA par mois.",
      "10 analyses et 10 workflows par mois.",
      "Import PDF, citations et export complet.",
    ],
    note: "Les plafonds de fichiers restent applicables ; ne pas confondre avec les fonctions illimitées de Pro.",
  },
  {
    name: "Jenni Ai Pro",
    websiteUrl: "https://docs.jenni.ai/docs/account/plans-and-billing/",
    features: [
      "Autocomplétion, édition, chat, analyses et workflows sans quotas de génération annoncés.",
      "Import PDF et export complet.",
      "PDF jusqu’à 1 000 pages et assistance prioritaire.",
    ],
    note: "Les limites techniques de fichiers et les conditions d’utilisation restent applicables.",
  },
  {
    name: "Kimi Plus",
    websiteUrl: "https://www.kimi.ai/help/kimi-code/benefits",
    features: [
      "Kimi Code inclus dans les nouvelles formules internationales Plus.",
      "Accès depuis les outils de développement compatibles.",
      "Quota partagé entre les appareils et outils connectés.",
    ],
    note: "Fenêtre de limitation de 5 heures et quota mensuel ; les anciens abonnements gardent leurs propres règles.",
  },
  {
    name: "Lovable Pro",
    websiteUrl: "https://lovable.dev/pricing",
    features: [
      "Création de sites et applications par conversation.",
      "Crédits d’abonnement utilisables pour la construction, Cloud et IA.",
      "Collaboration dans un espace de travail avec crédits partagés.",
    ],
    note: "Le nombre de crédits dépend de la formule ; hébergement et IA peuvent consommer le solde.",
  },
  {
    name: "Notion Plus",
    websiteUrl: "https://www.notion.com/pricing",
    features: [
      "Collaboration, bases de données et graphiques.",
      "Formulaires et sites personnalisables.",
      "Téléversement de fichiers et connexions de base.",
    ],
    note: "Notion AI est présenté en essai sur Plus, pas comme l’ensemble des fonctions Business incluses.",
  },
  {
    name: "Notion Business",
    websiteUrl: "https://www.notion.com/pricing",
    features: [
      "Fonctions Plus et Notion Agent.",
      "Comptes rendus de réunions IA et recherche dans les applications connectées.",
      "SSO SAML, permissions fines et espaces privés.",
    ],
    note: "Les agents personnalisés peuvent utiliser des crédits supplémentaires.",
  },
  {
    name: "Perplexity Pro",
    websiteUrl: "https://www.perplexity.ai/help-center/en/articles/10352901-what-is-perplexity-pro",
    features: [
      "Recherche approfondie avec sources citées.",
      "Choix de modèles IA avancés.",
      "Analyse de fichiers et de photos avec accès élargi.",
      "Création d’images et accès limité à la génération vidéo.",
    ],
    note: "Les modèles disponibles et leurs limites peuvent évoluer.",
  },
  {
    name: "Skywork Ai",
    websiteUrl: "https://skywork.ai/",
    features: [
      "Création assistée de présentations et de documents.",
      "Outils pour feuilles de calcul, images et vidéos.",
    ],
    note: "Le nom ne précise aucun niveau d’abonnement. Confirmer la formule et les crédits ; les offres Skywork Note ne sont pas automatiquement équivalentes.",
  },
  {
    name: "Twitter X Premium",
    websiteUrl: "https://help.x.com/en/using-x/x-premium",
    features: [
      "Fonctions Basic avec publications et vidéos plus longues.",
      "Publicités réduites et priorité renforcée dans les réponses.",
      "Accès accru à Grok et outils pour créateurs.",
    ],
    note: "Badge bleu et monétisation soumis à vérification et éligibilité ; Premium n’est pas Premium+.",
  },
  {
    name: "Twitter Plus X",
    websiteUrl: "https://help.x.com/en/using-x/x-premium",
    features: [],
    note: "Libellé ambigu : confirmer s’il s’agit de Basic, Premium ou Premium+. Aucun avantage d’un niveau supérieur n’est promis sans confirmation.",
  },
];
export function officialTechDetails(name: string) {
  return TECH_OFFICIAL_SERVICE_DETAILS.find(
    (entry) => entry.name.toLocaleLowerCase("fr") === name.trim().toLocaleLowerCase("fr"),
  );
}
export function officialTechFeatures(entry: OfficialDetails) {
  return [
    ...entry.features,
    ...(entry.note ? [`À noter : ${entry.note}`] : []),
    `Source consultée le ${TECH_SERVICE_DETAILS_CHECKED}. Les conditions du fournisseur font foi.`,
  ].join("\n");
}
