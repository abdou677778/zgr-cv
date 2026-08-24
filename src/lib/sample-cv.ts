import sampleData from "@/assets/donnees-cv-clean.json";
import { importCvJson } from "./cv-json";
import type { CV } from "./cv-types";
import type { DocumentLanguage } from "./document-language";

// The bundled example is generated from the same structured JSON accepted by
// the Import JSON feature. Vite embeds the data in the autonomous HTML, so the
// Example button never depends on an external file being present.
const frenchSample = importCvJson(sampleData, "fr").cv;
const englishSample = importCvJson(sampleData, "en").cv;
const cloneCv = (): CV => {
  const cv = JSON.parse(JSON.stringify(englishSample)) as typeof englishSample;
  cv.lettre_motivation = {
    ...cv.lettre_motivation,
    date: "",
    objet: "",
    salutation: "",
    formule_politesse: "",
  };
  return cv;
};

type ExtraLanguage = Exclude<DocumentLanguage, "fr" | "en">;

type SampleLocale = {
  title: string;
  address: string;
  relocation: string;
  birthday: string;
  marital: string;
  licence: string;
  military: string;
  wilaya: string;
  country: string;
  objective: string;
  skills: string[];
  levels: CV["langues"];
  experienceTitles: string[];
  experienceDescriptions: string[][];
  educationTitles: string[];
  educationEquivalences: string[];
  trainingTitles: string[];
  trainingInstitutions: string[];
  trainingSkills: string[];
  participations: string[];
  certifications: string[];
  interests: string[];
  reference: string;
  application: string;
  letter: {
    subject: string;
    salutation: string;
    paragraphs: string[];
    closing: string;
  };
  plan: string[];
};

const LOCALES: Record<ExtraLanguage, SampleLocale> = {
  es: {
    title: "Ingeniero de software full-stack",
    address: "Montreal, QC, Canadá",
    relocation: "Disponible para trasladarse a cualquier lugar de Canadá",
    birthday: "15 de marzo de 1992",
    marital: "Soltero",
    licence: "Permiso de conducir válido de categoría B",
    military: "Exento",
    wilaya: "Argel, Argelia",
    country: "Canadá (residente temporal con proyecto de residencia permanente)",
    objective:
      "Ingeniero de software full-stack motivado, con varios años de experiencia en desarrollo web e integración de API, que desea contribuir a proyectos innovadores en una empresa canadiense orientada a la calidad, la colaboración y la mejora continua",
    skills: [
      "Desarrollo web full-stack con JavaScript, TypeScript, Node.js y React",
      "Diseño, optimización y mantenimiento de bases de datos SQL y NoSQL",
      "Diseño e integración de API REST y GraphQL en arquitecturas distribuidas",
      "Implementación de canalizaciones CI/CD y uso de Docker en un entorno DevOps",
      "Aplicación de metodologías Agile y Scrum en equipos multidisciplinares",
      "Análisis de requisitos y conversión en soluciones técnicas robustas y escalables",
      "Comunicación eficaz, trabajo en equipo y adaptación a entornos multiculturales",
    ],
    levels: {
      fr: "Competencia profesional",
      en: "Nivel intermedio alto",
      ar: "Lengua materna",
      de: "Conocimientos básicos",
      es: "Conocimientos básicos",
      kab: "Buen nivel oral",
    },
    experienceTitles: [
      "Desarrollador de software full-stack",
      "Desarrollador web",
      "Desarrollador de software en prácticas",
      "Desarrollador web autónomo",
    ],
    experienceDescriptions: [
      [
        "Diseño, desarrollo y mantenimiento de aplicaciones web SaaS con React y Node.js para clientes norteamericanos",
        "Implementación de API REST seguras y documentadas, integradas con servicios externos y PostgreSQL",
        "Colaboración con los equipos de producto, QA y UX en un entorno Agile para entregar funcionalidades de calidad",
        "Participación en revisiones de código, mentoría de desarrolladores junior y mejora continua de los estándares",
      ],
      [
        "Desarrollo de sitios y aplicaciones web a medida con JavaScript, PHP y Laravel para pymes locales",
        "Análisis de las necesidades del cliente y redacción de especificaciones funcionales y técnicas",
        "Optimización del rendimiento front-end y back-end para mejorar la experiencia de usuario y el SEO",
        "Mantenimiento de aplicaciones, corrección de errores y evolución funcional según las opiniones de los clientes",
      ],
      [
        "Participación en el desarrollo de un prototipo de plataforma web para la gestión interna de proyectos",
        "Implementación de módulos front-end con HTML, CSS y JavaScript moderno",
        "Redacción de documentación técnica para facilitar el mantenimiento y la evolución del código",
        "Colaboración con el equipo de investigación para evaluar distintas arquitecturas de software",
      ],
      [
        "Creación de sitios web corporativos y herramientas internas para comercios y asociaciones locales",
        "Gestión del ciclo completo del proyecto, desde la recopilación de requisitos hasta la producción",
        "Soporte técnico básico y formación de los usuarios finales",
        "Gestión de relaciones cercanas con los clientes y propuesta de mejoras adaptadas",
      ],
    ],
    educationTitles: [
      "Máster en Informática, especialidad en Sistemas de Información",
      "Grado en Informática",
      "Año preparatorio en ciencias y tecnología",
    ],
    educationEquivalences: [
      "Equivalencia en evaluación por las autoridades canadienses competentes",
      "Título comparable a un grado canadiense en Informática según los estándares generales",
      "Créditos preuniversitarios de ciencias reconocidos como formación preparatoria",
    ],
    trainingTitles: [
      "Desarrollo avanzado con React y TypeScript",
      "Introducción a Docker y a las canalizaciones CI/CD",
      "Diseño de API REST seguras",
      "Metodologías Agile y Scrum",
    ],
    trainingInstitutions: [
      "Plataforma internacional de formación en línea",
      "Proveedor de cursos en línea especializado en tecnologías DevOps",
      "Plataforma de aprendizaje técnico",
      "Centro de formación en gestión de proyectos",
    ],
    trainingSkills: [
      "Gestión de estado, hooks avanzados, tipado fuerte y buenas prácticas de rendimiento en React",
      "Contenedorización, creación de Dockerfiles e implementación de canalizaciones CI/CD básicas",
      "Diseño de API REST, autenticación, autorización y buenas prácticas de seguridad",
      "Comprensión del marco Scrum, sus roles, ceremonias y planificación incremental",
    ],
    participations: [
      "Participación como desarrollador full-stack en un hackatón de innovación digital de 48 horas en Montreal",
      "Asistencia habitual a encuentros técnicos sobre JavaScript, React y Node.js",
      "Participación en comunidades de desarrolladores para intercambiar buenas prácticas y experiencias",
      "Contribuciones ocasionales a proyectos de código abierto alojados en GitHub",
    ],
    certifications: [
      "Certificación en desarrollo web moderno con JavaScript",
      "Certificación en bases de datos relacionales y SQL",
      "Certificación de introducción a la computación en la nube",
      "Certificación en fundamentos de ciberseguridad para desarrolladores",
    ],
    interests: [
      "Seguimiento de tendencias en desarrollo de software y arquitectura cloud",
      "Entrenamiento en gimnasio y carrera para mantener un estilo de vida equilibrado",
      "Lectura sobre desarrollo personal, productividad y trabajo en equipo",
      "Viajes y descubrimiento de nuevas culturas, especialmente en Norteamérica y Europa",
    ],
    reference: "Disponible previa solicitud",
    application: "Candidatura a una oportunidad de desarrollador de software en Canadá",
    letter: {
      subject: "Candidatura al puesto de Ingeniero de software full-stack",
      salutation: "Estimado señor o señora",
      paragraphs: [
        "Actualmente trabajo como desarrollador de software full-stack en Montreal y deseo poner mis competencias técnicas y mi capacidad de colaboración al servicio de su organización, reconocida por sus proyectos innovadores y su entorno estimulante.",
        "A lo largo de mi trayectoria he diseñado y desarrollado aplicaciones web completas, tanto front-end como back-end, además de integrar API y optimizar bases de datos para entregar soluciones fiables y escalables.",
        "Acostumbrado a equipos multiculturales y plazos exigentes, estoy convencido de que mi rigor, mi rápida capacidad de aprendizaje y mi interés por las buenas prácticas me permitirán contribuir eficazmente a sus proyectos.",
        "Me complacería conversar sobre mi candidatura en una entrevista y explicar cómo mi perfil puede responder a sus necesidades actuales y futuras.",
      ],
      closing: "Atentamente",
    },
    plan: [
      "Mejorar el inglés profesional, especialmente la comunicación oral",
      "Reforzar las competencias en arquitectura de software y microservicios",
      "Profundizar en las prácticas DevOps y la observabilidad de aplicaciones",
      "Contribuir regularmente a proyectos de código abierto para ampliar el portafolio y la red profesional",
      "Adaptar el CV y las cartas a las expectativas del mercado canadiense",
    ],
  },
  de: {
    title: "Full-Stack-Softwareingenieur",
    address: "Montreal, QC, Kanada",
    relocation: "Umzugsbereit innerhalb Kanadas",
    birthday: "15. März 1992",
    marital: "Ledig",
    licence: "Gültiger Führerschein der Klasse B",
    military: "Befreit",
    wilaya: "Algier, Algerien",
    country: "Kanada (befristeter Aufenthalt mit geplantem Daueraufenthalt)",
    objective:
      "Motivierter Full-Stack-Softwareingenieur mit mehrjähriger Erfahrung in Webentwicklung und API-Integration, der innovative Projekte in einem kanadischen Unternehmen mit Fokus auf Qualität, Zusammenarbeit und kontinuierliche Verbesserung unterstützen möchte",
    skills: [
      "Full-Stack-Webentwicklung mit JavaScript, TypeScript, Node.js und React",
      "Entwurf, Optimierung und Wartung von SQL- und NoSQL-Datenbanken",
      "Entwurf und Integration von REST- und GraphQL-APIs in verteilten Architekturen",
      "Einrichtung von CI/CD-Pipelines und Einsatz von Docker im DevOps-Umfeld",
      "Anwendung von Agile- und Scrum-Methoden in multidisziplinären Teams",
      "Anforderungsanalyse und Umsetzung in robuste, skalierbare technische Lösungen",
      "Effektive Kommunikation, Teamgeist und Anpassungsfähigkeit in multikulturellen Umgebungen",
    ],
    levels: {
      fr: "Verhandlungssicher",
      en: "Gute Mittelstufe",
      ar: "Muttersprache",
      de: "Grundkenntnisse",
      es: "Grundkenntnisse",
      kab: "Gute mündliche Kenntnisse",
    },
    experienceTitles: [
      "Full-Stack-Softwareentwickler",
      "Webentwickler",
      "Praktikant Softwareentwicklung",
      "Freiberuflicher Webentwickler",
    ],
    experienceDescriptions: [
      [
        "Entwicklung und Wartung von SaaS-Webanwendungen mit React und Node.js für nordamerikanische Kunden",
        "Implementierung sicherer, dokumentierter REST-APIs mit Drittanbieterdiensten und PostgreSQL",
        "Zusammenarbeit mit Produkt-, QA- und UX-Teams zur agilen Bereitstellung hochwertiger Funktionen",
        "Mitwirkung an Code-Reviews, Mentoring von Junior-Entwicklern und kontinuierlicher Standardverbesserung",
      ],
      [
        "Entwicklung maßgeschneiderter Websites und Webanwendungen mit JavaScript, PHP und Laravel für lokale KMU",
        "Analyse von Kundenanforderungen und Erstellung funktionaler sowie technischer Spezifikationen",
        "Optimierung von Front- und Back-End für bessere Benutzererfahrung und Sichtbarkeit",
        "Anwendungswartung, Fehlerbehebung und Weiterentwicklung nach Kundenfeedback",
      ],
      [
        "Mitarbeit an einem Webplattform-Prototyp für das interne Projektmanagement",
        "Implementierung von Front-End-Modulen mit modernem HTML, CSS und JavaScript",
        "Erstellung technischer Dokumentation zur Unterstützung von Wartung und Weiterentwicklung",
        "Zusammenarbeit mit dem Forschungsteam bei der Bewertung verschiedener Softwarearchitekturen",
      ],
      [
        "Umsetzung kleiner Unternehmenswebsites und interner Werkzeuge für lokale Händler und Vereine",
        "Steuerung des gesamten Projektlebenszyklus von der Anforderung bis zum Produktivbetrieb",
        "Technischer Basissupport und Schulung der Endanwender",
        "Pflege enger Kundenbeziehungen durch regelmäßige, passende Verbesserungsvorschläge",
      ],
    ],
    educationTitles: [
      "Master in Informatik, Schwerpunkt Informationssysteme",
      "Bachelor in Informatik",
      "Vorbereitungsjahr in Naturwissenschaften und Technik",
    ],
    educationEquivalences: [
      "Anerkennung wird derzeit von den zuständigen kanadischen Behörden geprüft",
      "Nach allgemeinen Standards mit einem kanadischen Bachelorabschluss in Informatik vergleichbar",
      "Voruniversitäre naturwissenschaftliche Leistungen als Vorbereitungsausbildung anerkannt",
    ],
    trainingTitles: [
      "Fortgeschrittene Entwicklung mit React und TypeScript",
      "Einführung in Docker und CI/CD-Pipelines",
      "Entwurf sicherer REST-APIs",
      "Agile- und Scrum-Methoden",
    ],
    trainingInstitutions: [
      "International anerkannte Online-Lernplattform",
      "Auf DevOps-Technologien spezialisierter Online-Kursanbieter",
      "Technische Lernplattform",
      "Schulungszentrum für Projektmanagement",
    ],
    trainingSkills: [
      "State-Management, fortgeschrittene Hooks, starke Typisierung und React-Performance-Praktiken",
      "Containerisierung, Dockerfile-Erstellung und Einrichtung grundlegender CI/CD-Pipelines",
      "REST-API-Design, Authentifizierung, Autorisierung und bewährte Sicherheitsverfahren",
      "Verständnis des Scrum-Rahmens, der Rollen, Rituale und inkrementellen Planung",
    ],
    participations: [
      "Teilnahme an einem 48-stündigen Hackathon für digitale Innovation in Montreal als Full-Stack-Entwickler",
      "Regelmäßige Teilnahme an technischen Meetups zu JavaScript, React und Node.js",
      "Engagement in Online-Entwicklergemeinschaften zum Austausch bewährter Verfahren",
      "Gelegentliche Beiträge zu Open-Source-Projekten auf GitHub",
    ],
    certifications: [
      "Zertifizierung in moderner Webentwicklung mit JavaScript",
      "Zertifizierung in relationalen Datenbanken und SQL",
      "Einführungszertifizierung in Cloud Computing",
      "Zertifizierung zu Grundlagen der Cybersicherheit für Entwickler",
    ],
    interests: [
      "Beobachtung neuer Trends in Softwareentwicklung und Cloud-Architektur",
      "Fitness und Laufen für einen gesunden Lebensausgleich",
      "Lektüre zu Persönlichkeitsentwicklung, Produktivität und Teamarbeit",
      "Reisen und Entdeckung neuer Kulturen, besonders in Nordamerika und Europa",
    ],
    reference: "Auf Anfrage verfügbar",
    application: "Bewerbung auf eine Stelle als Softwareentwickler in Kanada",
    letter: {
      subject: "Bewerbung als Full-Stack-Softwareingenieur",
      salutation: "Sehr geehrte Damen und Herren",
      paragraphs: [
        "Derzeit arbeite ich als Full-Stack-Softwareentwickler in Montreal und möchte meine technischen Fähigkeiten sowie meine kooperative Arbeitsweise in Ihr für innovative Projekte bekanntes Unternehmen einbringen.",
        "In meinen bisherigen Positionen habe ich vollständige Webanwendungen im Front- und Back-End entwickelt, APIs integriert und Datenbanken optimiert, um zuverlässige und skalierbare Lösungen bereitzustellen.",
        "Die Arbeit in multikulturellen Teams und unter engen Fristen ist mir vertraut. Mit Sorgfalt, schneller Auffassungsgabe und Begeisterung für bewährte Entwicklungsverfahren kann ich Ihre Projekte wirksam unterstützen.",
        "Gerne erläutere ich Ihnen in einem persönlichen Gespräch, wie mein Profil zu Ihren aktuellen und zukünftigen Anforderungen passt.",
      ],
      closing: "Mit freundlichen Grüßen",
    },
    plan: [
      "Berufliches Englisch, besonders die mündliche Kommunikation, vertiefen",
      "Kenntnisse in Softwarearchitektur und Microservices stärken",
      "DevOps-Verfahren und Anwendungsbeobachtbarkeit weiter ausbauen",
      "Regelmäßig zu Open-Source-Projekten beitragen und das berufliche Netzwerk erweitern",
      "Lebenslauf und Anschreiben auf den kanadischen Arbeitsmarkt abstimmen",
    ],
  },
  it: {
    title: "Ingegnere software full-stack",
    address: "Montréal, QC, Canada",
    relocation: "Disponibile al trasferimento in tutto il Canada",
    birthday: "15 marzo 1992",
    marital: "Celibe",
    licence: "Patente di guida valida di categoria B",
    military: "Esentato",
    wilaya: "Algeri, Algeria",
    country: "Canada (residente temporaneo con progetto di residenza permanente)",
    objective:
      "Ingegnere software full-stack motivato, con diversi anni di esperienza nello sviluppo web e nell'integrazione di API, desideroso di contribuire a progetti innovativi in un'azienda canadese orientata alla qualità, alla collaborazione e al miglioramento continuo",
    skills: [
      "Sviluppo web full-stack con JavaScript, TypeScript, Node.js e React",
      "Progettazione, ottimizzazione e manutenzione di database SQL e NoSQL",
      "Progettazione e integrazione di API REST e GraphQL in architetture distribuite",
      "Implementazione di pipeline CI/CD e utilizzo di Docker in ambito DevOps",
      "Applicazione di metodologie Agile e Scrum in team multidisciplinari",
      "Analisi dei requisiti e traduzione in soluzioni tecniche robuste e scalabili",
      "Comunicazione efficace, spirito di squadra e adattabilità in ambienti multiculturali",
    ],
    levels: {
      fr: "Competenza professionale",
      en: "Livello intermedio avanzato",
      ar: "Madrelingua",
      de: "Conoscenze di base",
      es: "Conoscenze di base",
      kab: "Buon livello orale",
    },
    experienceTitles: [
      "Sviluppatore software full-stack",
      "Sviluppatore web",
      "Tirocinante sviluppatore software",
      "Sviluppatore web freelance",
    ],
    experienceDescriptions: [
      [
        "Progettazione, sviluppo e manutenzione di applicazioni web SaaS con React e Node.js per clienti nordamericani",
        "Implementazione di API REST sicure e documentate integrate con servizi esterni e PostgreSQL",
        "Collaborazione con i team prodotto, QA e UX in ambiente Agile per rilasciare funzionalità di qualità",
        "Partecipazione a code review, mentoring di sviluppatori junior e miglioramento continuo degli standard",
      ],
      [
        "Sviluppo di siti e applicazioni web su misura con JavaScript, PHP e Laravel per PMI locali",
        "Analisi delle esigenze dei clienti e redazione di specifiche funzionali e tecniche",
        "Ottimizzazione delle prestazioni front-end e back-end per migliorare esperienza utente e SEO",
        "Manutenzione applicativa, correzione di bug ed evoluzione delle funzioni secondo i feedback",
      ],
      [
        "Partecipazione allo sviluppo di un prototipo web per la gestione interna dei progetti",
        "Implementazione di moduli front-end con HTML, CSS e JavaScript moderno",
        "Redazione di documentazione tecnica per facilitare manutenzione ed evoluzione del codice",
        "Collaborazione con il team di ricerca nella valutazione di diverse architetture software",
      ],
      [
        "Realizzazione di siti vetrina e strumenti interni per commercianti e associazioni locali",
        "Gestione dell'intero ciclo di progetto, dalla raccolta dei requisiti alla produzione",
        "Supporto tecnico di base e formazione degli utenti finali",
        "Gestione di rapporti diretti con i clienti proponendo miglioramenti regolari e mirati",
      ],
    ],
    educationTitles: [
      "Laurea magistrale in Informatica, specializzazione Sistemi informativi",
      "Laurea in Informatica",
      "Anno preparatorio in scienze e tecnologie",
    ],
    educationEquivalences: [
      "Equipollenza in corso di valutazione presso le autorità canadesi competenti",
      "Titolo paragonabile a una laurea canadese in Informatica secondo gli standard generali",
      "Crediti scientifici preuniversitari riconosciuti come formazione preparatoria",
    ],
    trainingTitles: [
      "Sviluppo avanzato con React e TypeScript",
      "Introduzione a Docker e alle pipeline CI/CD",
      "Progettazione di API REST sicure",
      "Metodologie Agile e Scrum",
    ],
    trainingInstitutions: [
      "Piattaforma di formazione online riconosciuta a livello internazionale",
      "Fornitore di corsi online specializzato in tecnologie DevOps",
      "Piattaforma di apprendimento tecnico",
      "Centro di formazione in project management",
    ],
    trainingSkills: [
      "Gestione dello stato, hook avanzati, tipizzazione forte e buone pratiche di performance in React",
      "Containerizzazione, creazione di Dockerfile e configurazione di pipeline CI/CD di base",
      "Progettazione di API REST, autenticazione, autorizzazione e buone pratiche di sicurezza",
      "Comprensione del framework Scrum, dei ruoli, dei rituali e della pianificazione incrementale",
    ],
    participations: [
      "Partecipazione come sviluppatore full-stack a un hackathon di innovazione digitale di 48 ore a Montréal",
      "Partecipazione regolare a meetup tecnici su JavaScript, React e Node.js",
      "Attività in comunità online di sviluppatori per condividere buone pratiche ed esperienze",
      "Contributi occasionali a progetti open source ospitati su GitHub",
    ],
    certifications: [
      "Certificazione in sviluppo web moderno con JavaScript",
      "Certificazione in database relazionali e SQL",
      "Certificazione introduttiva al cloud computing",
      "Certificazione sui fondamenti di cybersicurezza per sviluppatori",
    ],
    interests: [
      "Aggiornamento sulle tendenze dello sviluppo software e dell'architettura cloud",
      "Allenamento in palestra e corsa per mantenere un sano equilibrio",
      "Lettura su crescita personale, produttività e lavoro di squadra",
      "Viaggi e scoperta di nuove culture, soprattutto in Nord America e in Europa",
    ],
    reference: "Disponibile su richiesta",
    application: "Candidatura per un'opportunità come sviluppatore software in Canada",
    letter: {
      subject: "Candidatura per la posizione di Ingegnere software full-stack",
      salutation: "Gentile responsabile della selezione",
      paragraphs: [
        "Attualmente lavoro come sviluppatore software full-stack a Montréal e desidero mettere le mie competenze tecniche e collaborative al servizio della vostra organizzazione, nota per i suoi progetti innovativi.",
        "Nel corso delle mie esperienze ho progettato e sviluppato applicazioni web complete, lavorando su front-end e back-end, integrando API e ottimizzando database per offrire soluzioni affidabili e scalabili.",
        "Abituato a team multiculturali e scadenze impegnative, sono certo che precisione, rapidità di apprendimento e attenzione alle buone pratiche mi consentiranno di contribuire efficacemente ai vostri progetti.",
        "Sarei lieto di approfondire la mia candidatura in un colloquio e illustrare come il mio profilo possa rispondere alle vostre esigenze attuali e future.",
      ],
      closing: "Cordiali saluti",
    },
    plan: [
      "Migliorare l'inglese professionale, in particolare la comunicazione orale",
      "Rafforzare le competenze in architettura software e microservizi",
      "Approfondire le pratiche DevOps e l'osservabilità delle applicazioni",
      "Contribuire regolarmente a progetti open source per ampliare portfolio e rete professionale",
      "Adattare CV e lettere alle aspettative del mercato canadese",
    ],
  },
  zh: {
    title: "全栈软件工程师",
    address: "加拿大魁北克省蒙特利尔",
    relocation: "可在加拿大境内搬迁",
    birthday: "1992年3月15日",
    marital: "未婚",
    licence: "持有有效B类驾驶执照",
    military: "已获豁免",
    wilaya: "阿尔及利亚阿尔及尔",
    country: "加拿大（临时居民，计划申请永久居留）",
    objective:
      "积极进取的全栈软件工程师，拥有多年Web开发和API集成经验，希望在重视质量、协作和持续改进的加拿大企业中参与创新项目",
    skills: [
      "使用JavaScript、TypeScript、Node.js和React进行全栈Web开发",
      "SQL和NoSQL数据库的设计、优化与维护",
      "分布式架构中REST和GraphQL API的设计与集成",
      "CI/CD流水线实施以及Docker在DevOps环境中的应用",
      "在跨职能团队中运用敏捷与Scrum方法",
      "分析业务需求并转化为稳健、可扩展的技术方案",
      "优秀的沟通、团队协作能力以及多元文化环境适应力",
    ],
    levels: {
      fr: "专业工作水平",
      en: "中高级水平",
      ar: "母语",
      de: "基础水平",
      es: "基础水平",
      kab: "良好口语水平",
    },
    experienceTitles: [
      "全栈软件开发工程师",
      "Web开发工程师",
      "软件开发实习生",
      "自由职业Web开发工程师",
    ],
    experienceDescriptions: [
      [
        "为北美客户设计、开发并维护基于React和Node.js的SaaS Web应用",
        "实施安全且文档完善的REST API，并集成第三方服务与PostgreSQL数据库",
        "与产品、QA和UX团队在敏捷环境中协作，持续交付高质量功能",
        "参与代码审查、初级开发人员指导及开发标准的持续改进",
      ],
      [
        "使用JavaScript、PHP和Laravel为本地中小企业开发定制网站与Web应用",
        "参与客户需求分析以及功能和技术规范编写",
        "优化前端和后端性能，提升用户体验与搜索可见度",
        "负责应用维护、缺陷修复及基于客户反馈的功能迭代",
      ],
      [
        "参与内部项目管理Web平台原型的开发",
        "使用现代HTML、CSS和JavaScript实现前端模块",
        "编写技术文档以支持代码维护和后续演进",
        "与研究团队合作评估不同的软件架构方案",
      ],
      [
        "为本地商户和协会交付展示型网站及内部工具",
        "管理从需求收集到生产部署的完整项目生命周期",
        "提供基础技术支持和最终用户培训",
        "通过定期提出针对性改进方案维护良好的客户关系",
      ],
    ],
    educationTitles: ["计算机科学硕士（信息系统方向）", "计算机科学学士", "科学与技术预科"],
    educationEquivalences: [
      "学历认证正在由加拿大相关主管机构评估",
      "依据通用标准，相当于加拿大计算机科学学士学位",
      "大学预科阶段的科学学分被认可为预备教育",
    ],
    trainingTitles: [
      "React与TypeScript高级开发",
      "Docker与CI/CD流水线入门",
      "安全REST API设计",
      "敏捷与Scrum方法",
    ],
    trainingInstitutions: [
      "国际认可的在线学习平台",
      "专注DevOps技术的在线课程机构",
      "技术学习平台",
      "项目管理培训中心",
    ],
    trainingSkills: [
      "掌握状态管理、高级Hooks、强类型以及React性能最佳实践",
      "应用容器化、Dockerfile编写及基础CI/CD流水线搭建",
      "REST API设计、身份验证、授权及安全最佳实践",
      "理解Scrum框架、角色、仪式与增量规划",
    ],
    participations: [
      "作为全栈开发人员参加蒙特利尔48小时数字创新黑客松",
      "定期参加JavaScript、React和Node.js技术交流活动",
      "参与在线开发者社区，分享最佳实践与经验",
      "偶尔为GitHub上的开源项目贡献代码",
    ],
    certifications: [
      "现代JavaScript Web开发认证",
      "关系型数据库与SQL认证",
      "云计算入门认证",
      "开发人员网络安全基础认证",
    ],
    interests: [
      "关注软件开发与云架构的新趋势",
      "健身与跑步，保持健康的生活平衡",
      "阅读个人成长、效率与团队协作类书籍",
      "旅行并探索不同文化，尤其是北美和欧洲",
    ],
    reference: "可应要求提供",
    application: "申请加拿大的软件开发职位",
    letter: {
      subject: "申请全栈软件工程师职位",
      salutation: "尊敬的招聘负责人",
      paragraphs: [
        "我目前在蒙特利尔担任全栈软件开发工程师，希望将技术能力和协作精神运用于贵组织，并为其创新项目和积极的工作环境作出贡献。",
        "在以往经历中，我参与了端到端Web应用的设计与开发，负责前端、后端、API集成和数据库优化，从而交付可靠且可扩展的解决方案。",
        "我熟悉多元文化团队和紧迫期限，相信严谨的工作态度、快速学习能力以及对工程最佳实践的重视能够帮助我有效支持贵方项目。",
        "期待有机会在面试中进一步介绍我的申请，并说明我的经验如何满足贵组织当前和未来的需求。",
      ],
      closing: "此致敬礼",
    },
    plan: [
      "提升职业英语水平，尤其是口语沟通能力",
      "加强软件架构和微服务设计能力",
      "持续学习DevOps实践和应用可观测性",
      "定期参与开源项目，丰富作品集并拓展职业网络",
      "根据加拿大市场和招聘实践调整简历与求职信",
    ],
  },
  ar: {
    title: "مهندس برمجيات متكامل",
    address: "مونتريال، كيبيك، كندا",
    relocation: "مستعد للانتقال إلى أي مكان داخل كندا",
    birthday: "15 مارس 1992",
    marital: "أعزب",
    licence: "رخصة قيادة سارية من الفئة B",
    military: "معفى",
    wilaya: "الجزائر العاصمة، الجزائر",
    country: "كندا (مقيم مؤقت مع مشروع إقامة دائمة)",
    objective:
      "مهندس برمجيات متكامل طموح يتمتع بخبرة متعددة السنوات في تطوير تطبيقات الويب وتكامل واجهات البرمجة، ويسعى للمساهمة في مشاريع مبتكرة داخل شركة كندية تركز على الجودة والتعاون والتحسين المستمر",
    skills: [
      "تطوير تطبيقات الويب المتكاملة باستخدام JavaScript وTypeScript وNode.js وReact",
      "تصميم قواعد بيانات SQL وNoSQL وتحسينها وصيانتها",
      "تصميم ودمج واجهات REST وGraphQL ضمن بنى موزعة",
      "إنشاء مسارات CI/CD واستخدام Docker في بيئة DevOps",
      "تطبيق منهجيات Agile وScrum ضمن فرق متعددة التخصصات",
      "تحليل المتطلبات وتحويلها إلى حلول تقنية متينة وقابلة للتوسع",
      "تواصل فعال وروح فريق وقدرة على التكيف في بيئات متعددة الثقافات",
    ],
    levels: {
      fr: "مستوى مهني",
      en: "فوق المتوسط",
      ar: "اللغة الأم",
      de: "معرفة أساسية",
      es: "معرفة أساسية",
      kab: "مستوى شفهي جيد",
    },
    experienceTitles: [
      "مطور برمجيات متكامل",
      "مطور ويب",
      "متدرب في تطوير البرمجيات",
      "مطور ويب مستقل",
    ],
    experienceDescriptions: [
      [
        "تصميم تطبيقات SaaS وصيانتها باستخدام React وNode.js لعملاء في أمريكا الشمالية",
        "تنفيذ واجهات REST آمنة وموثقة ومتكاملة مع خدمات خارجية وقواعد PostgreSQL",
        "التعاون مع فرق المنتج وضمان الجودة وتجربة المستخدم لتسليم وظائف عالية الجودة",
        "المشاركة في مراجعة الشفرة وتوجيه المطورين المبتدئين وتحسين معايير التطوير",
      ],
      [
        "تطوير مواقع وتطبيقات ويب مخصصة باستخدام JavaScript وPHP وLaravel لمؤسسات محلية",
        "تحليل احتياجات العملاء وصياغة المواصفات الوظيفية والتقنية",
        "تحسين أداء الواجهة الأمامية والخلفية وتجربة المستخدم والظهور في محركات البحث",
        "صيانة التطبيقات وإصلاح الأخطاء وتطوير الوظائف وفق ملاحظات العملاء",
      ],
      [
        "المساهمة في تطوير نموذج أولي لمنصة ويب لإدارة المشاريع الداخلية",
        "تنفيذ وحدات الواجهة الأمامية باستخدام HTML وCSS وJavaScript الحديثة",
        "إعداد وثائق تقنية لدعم صيانة الشفرة وتطويرها مستقبلاً",
        "التعاون مع فريق البحث لاختبار أساليب مختلفة لهندسة البرمجيات",
      ],
      [
        "إنجاز مواقع تعريفية وأدوات داخلية للتجار والجمعيات المحلية",
        "إدارة دورة المشروع كاملة من جمع المتطلبات إلى النشر الإنتاجي",
        "تقديم الدعم التقني الأساسي وتدريب المستخدمين النهائيين",
        "الحفاظ على علاقات وثيقة مع العملاء واقتراح تحسينات دورية مناسبة",
      ],
    ],
    educationTitles: [
      "ماجستير في علوم الحاسوب، تخصص نظم المعلومات",
      "ليسانس في علوم الحاسوب",
      "سنة تحضيرية في العلوم والتكنولوجيا",
    ],
    educationEquivalences: [
      "معادلة الشهادة قيد التقييم لدى الجهات الكندية المختصة",
      "شهادة مماثلة لبكالوريوس كندي في علوم الحاسوب وفق المعايير العامة",
      "أرصدة علمية قبل جامعية معترف بها كتكوين تحضيري",
    ],
    trainingTitles: [
      "تطوير متقدم باستخدام React وTypeScript",
      "مقدمة إلى Docker ومسارات CI/CD",
      "تصميم واجهات REST آمنة",
      "منهجيات Agile وScrum",
    ],
    trainingInstitutions: [
      "منصة تعلم إلكتروني معترف بها دولياً",
      "مزود دورات متخصص في تقنيات DevOps",
      "منصة تعلم تقني",
      "مركز تدريب على إدارة المشاريع",
    ],
    trainingSkills: [
      "إدارة الحالة والخطافات المتقدمة والأنواع الصارمة وأفضل ممارسات أداء React",
      "حاويات التطبيقات وإنشاء Dockerfile وإعداد مسارات CI/CD أساسية",
      "تصميم واجهات REST والمصادقة والتفويض وأفضل ممارسات الأمن",
      "فهم إطار Scrum والأدوار والطقوس والتخطيط التدريجي",
    ],
    participations: [
      "المشاركة كمطور متكامل في هاكاثون للابتكار الرقمي لمدة 48 ساعة في مونتريال",
      "حضور لقاءات تقنية دورية حول JavaScript وReact وNode.js",
      "المشاركة في مجتمعات المطورين لتبادل أفضل الممارسات والخبرات",
      "مساهمات متفرقة في مشاريع مفتوحة المصدر على GitHub",
    ],
    certifications: [
      "شهادة في تطوير الويب الحديث باستخدام JavaScript",
      "شهادة في قواعد البيانات العلائقية وSQL",
      "شهادة تمهيدية في الحوسبة السحابية",
      "شهادة في أساسيات الأمن السيبراني للمطورين",
    ],
    interests: [
      "متابعة الاتجاهات الجديدة في تطوير البرمجيات والهندسة السحابية",
      "التمارين الرياضية والجري للحفاظ على توازن صحي",
      "قراءة كتب التطوير الشخصي والإنتاجية والعمل الجماعي",
      "السفر واكتشاف ثقافات جديدة، خاصة في أمريكا الشمالية وأوروبا",
    ],
    reference: "متاحة عند الطلب",
    application: "طلب توظيف لمنصب مطور برمجيات في كندا",
    letter: {
      subject: "طلب توظيف لمنصب مهندس برمجيات متكامل",
      salutation: "السيد أو السيدة مسؤول التوظيف المحترم",
      paragraphs: [
        "أعمل حالياً مطور برمجيات متكاملاً في مونتريال، وأرغب في توظيف مهاراتي التقنية وروح التعاون لخدمة مؤسستكم المعروفة بمشاريعها المبتكرة وبيئة العمل المحفزة.",
        "شاركت خلال خبراتي السابقة في تصميم تطبيقات ويب متكاملة وتطويرها على الواجهتين الأمامية والخلفية، إضافة إلى دمج الواجهات وتحسين قواعد البيانات لتقديم حلول موثوقة وقابلة للتوسع.",
        "اعتدت العمل ضمن فرق متعددة الثقافات والالتزام بالمواعيد الضيقة، وأثق بأن الدقة وسرعة التعلم والاهتمام بأفضل الممارسات ستتيح لي المساهمة بفعالية في مشاريعكم.",
        "يسعدني مناقشة طلبي في مقابلة وشرح كيفية توافق خبراتي مع احتياجات مؤسستكم الحالية والمستقبلية.",
      ],
      closing: "وتفضلوا بقبول فائق الاحترام",
    },
    plan: [
      "تطوير الإنجليزية المهنية، ولا سيما التواصل الشفهي",
      "تعزيز المهارات في هندسة البرمجيات وتصميم الخدمات المصغرة",
      "مواصلة تعلم ممارسات DevOps وقابلية مراقبة التطبيقات",
      "المساهمة دورياً في مشاريع مفتوحة المصدر لتوسيع معرض الأعمال والشبكة المهنية",
      "تكييف السيرة الذاتية ورسائل التقديم مع متطلبات السوق الكندية",
    ],
  },
};

type SampleStructureLocale = {
  experienceDates: string[];
  experienceLocations: string[];
  experienceEmployers: string[];
  educationLocations: string[];
  educationInstitutions: string[];
  trainingLocations: string[];
};

const STRUCTURE_LOCALES: Record<ExtraLanguage, SampleStructureLocale> = {
  es: {
    experienceDates: [
      "Junio 2022 – Octubre 2025",
      "Enero 2019 – Mayo 2022",
      "Septiembre 2017 – Diciembre 2018",
      "Junio 2016 – Agosto 2017",
    ],
    experienceLocations: [
      "Montreal, QC, Canadá",
      "Argel, Argelia",
      "Argel, Argelia",
      "Argel, Argelia",
    ],
    experienceEmployers: [
      "TechNova Solutions, Montreal",
      "DigitalDZ Studio, Argel",
      "Startup InnovIT, Argel",
      "Trabajador autónomo",
    ],
    educationLocations: ["Argel, Argelia", "Argel, Argelia", "Argel, Argelia"],
    educationInstitutions: [
      "Universidad de Ciencia y Tecnología Houari-Boumediene (USTHB)",
      "Universidad de Ciencia y Tecnología Houari-Boumediene (USTHB)",
      "Institución universitaria pública de Argel",
    ],
    trainingLocations: ["En línea", "En línea", "En línea", "Argel, Argelia"],
  },
  de: {
    experienceDates: [
      "Juni 2022 – Oktober 2025",
      "Januar 2019 – Mai 2022",
      "September 2017 – Dezember 2018",
      "Juni 2016 – August 2017",
    ],
    experienceLocations: [
      "Montreal, Québec, Kanada",
      "Algier, Algerien",
      "Algier, Algerien",
      "Algier, Algerien",
    ],
    experienceEmployers: [
      "TechNova Solutions, Montreal",
      "DigitalDZ Studio, Algier",
      "Startup InnovIT, Algier",
      "Selbstständig",
    ],
    educationLocations: ["Algier, Algerien", "Algier, Algerien", "Algier, Algerien"],
    educationInstitutions: [
      "Universität für Wissenschaft und Technologie Houari-Boumediene (USTHB)",
      "Universität für Wissenschaft und Technologie Houari-Boumediene (USTHB)",
      "Öffentliche Hochschule in Algier",
    ],
    trainingLocations: ["Online", "Online", "Online", "Algier, Algerien"],
  },
  it: {
    experienceDates: [
      "Giugno 2022 – Ottobre 2025",
      "Gennaio 2019 – Maggio 2022",
      "Settembre 2017 – Dicembre 2018",
      "Giugno 2016 – Agosto 2017",
    ],
    experienceLocations: [
      "Montréal, Québec, Canada",
      "Algeri, Algeria",
      "Algeri, Algeria",
      "Algeri, Algeria",
    ],
    experienceEmployers: [
      "TechNova Solutions, Montréal",
      "DigitalDZ Studio, Algeri",
      "Startup InnovIT, Algeri",
      "Lavoratore autonomo",
    ],
    educationLocations: ["Algeri, Algeria", "Algeri, Algeria", "Algeri, Algeria"],
    educationInstitutions: [
      "Università della Scienza e della Tecnologia Houari-Boumediene (USTHB)",
      "Università della Scienza e della Tecnologia Houari-Boumediene (USTHB)",
      "Istituto universitario pubblico di Algeri",
    ],
    trainingLocations: ["Online", "Online", "Online", "Algeri, Algeria"],
  },
  zh: {
    experienceDates: [
      "2022年6月 – 2025年10月",
      "2019年1月 – 2022年5月",
      "2017年9月 – 2018年12月",
      "2016年6月 – 2017年8月",
    ],
    experienceLocations: [
      "加拿大魁北克省蒙特利尔",
      "阿尔及利亚阿尔及尔",
      "阿尔及利亚阿尔及尔",
      "阿尔及利亚阿尔及尔",
    ],
    experienceEmployers: [
      "TechNova Solutions（蒙特利尔）",
      "DigitalDZ Studio（阿尔及尔）",
      "Startup InnovIT（阿尔及尔）",
      "自由职业",
    ],
    educationLocations: ["阿尔及利亚阿尔及尔", "阿尔及利亚阿尔及尔", "阿尔及利亚阿尔及尔"],
    educationInstitutions: [
      "胡阿里·布迈丁科技大学（USTHB）",
      "胡阿里·布迈丁科技大学（USTHB）",
      "阿尔及尔公立大学机构",
    ],
    trainingLocations: ["在线", "在线", "在线", "阿尔及利亚阿尔及尔"],
  },
  ar: {
    experienceDates: [
      "يونيو 2022 – أكتوبر 2025",
      "يناير 2019 – مايو 2022",
      "سبتمبر 2017 – ديسمبر 2018",
      "يونيو 2016 – أغسطس 2017",
    ],
    experienceLocations: [
      "مونتريال، كيبيك، كندا",
      "الجزائر العاصمة، الجزائر",
      "الجزائر العاصمة، الجزائر",
      "الجزائر العاصمة، الجزائر",
    ],
    experienceEmployers: [
      "TechNova Solutions، مونتريال",
      "DigitalDZ Studio، الجزائر العاصمة",
      "Startup InnovIT، الجزائر العاصمة",
      "عمل حر",
    ],
    educationLocations: [
      "الجزائر العاصمة، الجزائر",
      "الجزائر العاصمة، الجزائر",
      "الجزائر العاصمة، الجزائر",
    ],
    educationInstitutions: [
      "جامعة هواري بومدين للعلوم والتكنولوجيا (USTHB)",
      "جامعة هواري بومدين للعلوم والتكنولوجيا (USTHB)",
      "مؤسسة جامعية عمومية بالجزائر العاصمة",
    ],
    trainingLocations: ["عبر الإنترنت", "عبر الإنترنت", "عبر الإنترنت", "الجزائر العاصمة، الجزائر"],
  },
};

function localizedClone(language: ExtraLanguage): CV {
  const cv = cloneCv();
  const locale = LOCALES[language];
  const structure = STRUCTURE_LOCALES[language];
  if (language === "ar") cv.nom_complet = "أمين بن سالم";
  cv.titre_poste = locale.title;
  cv.adresse = locale.address;
  cv.statut_relocation = locale.relocation;
  cv.date_naissance = locale.birthday;
  cv.situation_familiale = locale.marital;
  cv.permis_conduire = locale.licence;
  cv.service_national = locale.military;
  cv.wilaya = locale.wilaya;
  cv.pays = locale.country;
  cv.candidature = locale.application;
  cv.objectif = locale.objective;
  cv.competences = locale.skills;
  cv.langues = locale.levels;
  cv.experiences.forEach((experience, index) => {
    experience.dates = structure.experienceDates[index] ?? experience.dates;
    experience.lieu = structure.experienceLocations[index] ?? experience.lieu;
    experience.employeur = structure.experienceEmployers[index] ?? experience.employeur;
    experience.titre = locale.experienceTitles[index] ?? experience.titre;
    experience.descriptions = locale.experienceDescriptions[index] ?? experience.descriptions;
  });
  cv.educations.forEach((education, index) => {
    education.lieu = structure.educationLocations[index] ?? education.lieu;
    education.institution = structure.educationInstitutions[index] ?? education.institution;
    education.titre = locale.educationTitles[index] ?? education.titre;
    education.equivalence = locale.educationEquivalences[index] ?? education.equivalence;
  });
  cv.formations.forEach((training, index) => {
    training.titre = locale.trainingTitles[index] ?? training.titre;
    training.institution = locale.trainingInstitutions[index] ?? training.institution;
    training.competences = locale.trainingSkills[index] ?? training.competences;
    training.lieu = structure.trainingLocations[index] ?? training.lieu;
  });
  cv.participations = locale.participations;
  cv.certifications = locale.certifications;
  cv.interets = locale.interests;
  cv.references = [locale.reference];
  cv.lettre_motivation = {
    date: "",
    objet: locale.letter.subject,
    destinataire: "",
    salutation: locale.letter.salutation,
    paragraphes: locale.letter.paragraphs,
    formule_politesse: locale.letter.closing,
  };
  cv.plan_developpement = locale.plan;
  return cv;
}

// French and English come directly from the imported JSON. The five additional
// samples are complete, independent contextual translations and remain editable.
export const sampleCVByLanguage: Record<DocumentLanguage, ReturnType<typeof importCvJson>["cv"]> = {
  fr: frenchSample,
  en: englishSample,
  es: localizedClone("es"),
  de: localizedClone("de"),
  it: localizedClone("it"),
  zh: localizedClone("zh"),
  ar: localizedClone("ar"),
};

export const sampleCV = sampleCVByLanguage.fr;
