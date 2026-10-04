import { expect, test, type BrowserContext, type Page, type Route } from "@playwright/test";
import { readFile } from "node:fs/promises";

type TestUser = {
  username: string;
  displayName: string;
  role: "admin" | "editor" | "viewer";
  active: true;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string;
  loginCount: number;
  workflowManager?: boolean;
};

type StoredProfile = Record<string, unknown> & {
  id: string;
  revision: number;
  name: string;
  email: string;
  phone: string;
  createdAt: string;
  updatedAt: string;
  createdBy: Pick<TestUser, "username" | "displayName" | "role">;
  updatedBy: Pick<TestUser, "username" | "displayName" | "role">;
  workflowStatus?: "draft" | "review" | "approved";
  workflowUpdatedAt?: string;
  workflowUpdatedBy?: Pick<TestUser, "username" | "displayName" | "role">;
  workflowComment?: string;
  workflowCommentAt?: string;
  workflowCommentBy?: Pick<TestUser, "username" | "displayName" | "role">;
  workflowAssignee?: Pick<TestUser, "username" | "displayName" | "role">;
  workflowAssignedAt?: string;
  workflowAssignedBy?: Pick<TestUser, "username" | "displayName" | "role">;
};

const USERS: Record<string, TestUser> = {
  admin: {
    username: "admin",
    displayName: "Administrateur E2E",
    role: "admin",
    active: true,
    createdAt: "2026-09-11T08:00:00.000Z",
    updatedAt: "2026-09-11T08:00:00.000Z",
    lastLoginAt: "2026-09-11T08:00:00.000Z",
    loginCount: 1,
    workflowManager: true,
  },
  editeur: {
    username: "editeur",
    displayName: "Éditeur E2E",
    role: "editor",
    active: true,
    createdAt: "2026-09-11T08:00:00.000Z",
    updatedAt: "2026-09-11T08:00:00.000Z",
    lastLoginAt: "2026-09-11T08:00:00.000Z",
    loginCount: 1,
    workflowManager: true,
  },
  lecteur: {
    username: "lecteur",
    displayName: "Lecteur E2E",
    role: "viewer",
    active: true,
    createdAt: "2026-09-11T08:00:00.000Z",
    updatedAt: "2026-09-11T08:00:00.000Z",
    lastLoginAt: "2026-09-11T08:00:00.000Z",
    loginCount: 1,
  },
};

function actor(user: TestUser) {
  return { username: user.username, displayName: user.displayName, role: user.role };
}

function publicTestUser(user: TestUser) {
  const canEdit = user.role === "admin" || user.role === "editor";
  const clientsApprove = user.role === "admin" || user.workflowManager === true;
  return {
    ...user,
    workflowManager: clientsApprove,
    permissions: {
      clientsRead: true,
      clientsWrite: canEdit,
      clientsApprove,
      clientsDelete: user.role === "admin",
      clientsRestore: user.role === "admin",
      clientsDownload: true,
      aiUse: canEdit,
      manageUsers: user.role === "admin",
    },
  };
}

function tokenFor(username: string) {
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3_600, sub: username }),
  ).toString("base64url");
  return `${payload}.e2e-signature`;
}

class SharedClientApi {
  readonly profiles = new Map<string, StoredProfile>();
  readonly profileVersions = new Map<string, Map<number, StoredProfile>>();
  readonly sessions = new Map<string, TestUser>();
  readonly offlineUsers = new Set<string>();
  private revisionClock = 0;

  private async respond(route: Route, status: number, body: unknown) {
    await route.fulfill({
      status,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(body),
    });
  }

  private authenticatedUser(route: Route) {
    const authorization = route.request().headers().authorization || "";
    return this.sessions.get(authorization.replace(/^Bearer\s+/i, ""));
  }

  private summary(profile: StoredProfile) {
    return {
      id: profile.id,
      revision: profile.revision,
      name: profile.name,
      email: profile.email,
      phone: profile.phone,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
      createdBy: profile.createdBy,
      updatedBy: profile.updatedBy,
      workflowStatus: profile.workflowStatus ?? "draft",
      workflowUpdatedAt: profile.workflowUpdatedAt,
      workflowUpdatedBy: profile.workflowUpdatedBy,
      workflowComment: profile.workflowComment,
      workflowCommentAt: profile.workflowCommentAt,
      workflowCommentBy: profile.workflowCommentBy,
      workflowAssignee: profile.workflowAssignee,
      workflowAssignedAt: profile.workflowAssignedAt,
      workflowAssignedBy: profile.workflowAssignedBy,
      language: profile.language,
      hasPhoto: false,
    };
  }

  async handle(route: Route) {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();

    if (url.pathname === "/api/opportunities/search" && method === "GET") {
      const country = url.searchParams.get("country") || "TN";
      return this.respond(route, 200, {
        opportunities: [
          {
            id: "54646",
            title: "Buon cammino",
            organization: "KALISTRATIA ODV",
            description: "Protection de l’environnement et durabilité écologique.",
            participantProfile: "Jeunes de 18 à 29 ans.",
            ageRequirement: {
              minimum: 18,
              maximum: 29,
              label: "18–29 ans",
              source: "participant_profile",
              programmeMaximum: 30,
            },
            applicationMethod: {
              type: "portal_account",
              label: "Connexion EU Login requise",
              url: "https://youth.europa.eu/solidarity/register_en",
              portalAccountRequired: true,
              note: "Connectez-vous ou rejoignez le Corps européen de solidarité avant de postuler.",
            },
            applicationRequirements: { cv: true, motivationStatement: true },
            destination: { town: "Polia", countryCode: "IT", countryName: "Italie" },
            activityType: "individual",
            topics: ["natr"],
            startAt: "2026-10-08T12:00:00.000Z",
            endAt: "2026-11-17T12:00:00.000Z",
            deadlineAt: "2026-10-04T23:00:00.000Z",
            publishedAt: "2026-10-02T15:47:22.000Z",
            updatedAt: "2026-10-02T16:05:03.000Z",
            eligibilityCodes: ["TN", "DZ"],
            eligibilitySource: "funding_programme.residence_countries",
            sourceUrl: "https://youth.europa.eu/solidarity/opportunity/54646_en",
            checkedAt: "2026-10-02T17:00:00.000Z",
            eligible: true,
            eligibleCountry: {
              code: country,
              name: country === "DZ" ? "Algérie" : "Tunisie",
            },
          },
        ],
        meta: {
          participantCountry: {
            code: country,
            name: country === "DZ" ? "Algérie" : "Tunisie",
          },
          period: url.searchParams.get("period") || "week",
          returned: 1,
          totalMatches: 1,
          scanned: 200,
          pagesScanned: 1,
          verifiedAt: "2026-10-02T17:00:00.000Z",
          stale: false,
          sourceUrl: "https://youth.europa.eu/go-abroad/volunteering/opportunities_en",
          methodology: "Contrôle exact du pays.",
          cacheVersion: 3,
          sourceStrategy: "official_structured_api",
        },
      });
    }

    if (url.pathname === "/api/canada-opportunities/search" && method === "GET") {
      const country = (url.searchParams.get("country") || "DZ") as "DZ" | "TN";
      return this.respond(route, 200, {
        opportunities: [
          {
            id: "50411434",
            title: "senior accountant",
            employer: "MANNING ELLIOTT LLP",
            employerUrl: "https://www.manningelliott.com/",
            description: "Permanent employment, full time.",
            location: "Surrey, BC",
            salary: "$80,000.00 to $104,000.00 annually",
            workplace: "Hybrid",
            employmentType: "Permanent employment Full time",
            postedAt: "2026-10-02T00:00:00.000Z",
            deadlineAt: "2026-10-16T00:00:00.000Z",
            sourceUrl: "https://www.jobbank.gc.ca/jobsearch/jobposting/50411434",
            acceptsInternational: true,
            eligibilityEvidence:
              "L’employeur accepte explicitement les candidats avec ou sans permis de travail canadien valide.",
            lmiaStatus: "not_specified",
            applicationMethod: {
              type: "email",
              label: "Postuler par e-mail",
              url: "mailto:careers@manningelliott.example",
              loginRequired: false,
              note: "Envoyez votre CV à l’adresse publiée par l’employeur.",
            },
            applicationContact: {
              type: "email",
              email: "careers@manningelliott.example",
              phone: "",
              url: "mailto:careers@manningelliott.example",
              label: "Postuler par e-mail",
              details: "Envoyez votre CV et votre lettre de motivation.",
              loginRequired: false,
            },
            applicationOptions: [
              {
                type: "email",
                email: "careers@manningelliott.example",
                phone: "",
                url: "mailto:careers@manningelliott.example",
                label: "Postuler par e-mail",
                details: "Envoyez votre CV et votre lettre de motivation.",
                loginRequired: false,
              },
              {
                type: "job_bank_direct",
                email: "",
                phone: "",
                url: "https://www.jobbank.gc.ca/jobsearch/jobposting/50411434",
                label: "Candidature directe Guichet-Emplois",
                details: "Un compte Plus est requis.",
                loginRequired: true,
              },
            ],
            applicationContactStatus: "verified",
            candidateCountry: {
              code: country,
              name: country === "TN" ? "Tunisie" : "Algérie",
            },
            checkedAt: "2026-10-02T18:00:00.000Z",
          },
        ],
        sources: {
          jobBank: {
            name: "Guichet-Emplois Canada",
            url: "https://www.jobbank.gc.ca/findajob/foreign-candidates",
            automated: true,
          },
          indeed: {
            name: "Indeed Canada",
            url: "https://ca.indeed.com/jobs?q=foreign+candidates+outside+canada&sort=date",
            automated: false,
            reason: "Indeed interdit le scraping automatisé sans autorisation écrite.",
          },
        },
        meta: {
          country: { code: country, name: country === "TN" ? "Tunisie" : "Algérie" },
          period: url.searchParams.get("period") || "week",
          returned: 1,
          totalMatches: 1,
          scanned: 18,
          verifiedAt: "2026-10-02T18:00:00.000Z",
          stale: false,
          sourceUrl: "https://www.jobbank.gc.ca/jobsearch/jobsearch?fglo=1&sort=M",
          methodology: "Contrôle de la fiche officielle.",
        },
      });
    }

    if (url.pathname === "/api/aneti-opportunities/search" && method === "GET") {
      return this.respond(route, 200, {
        opportunities: [
          {
            id: "1055923",
            title: "Opérateur socio-sanitaire",
            country: "Italie",
            postedAt: "2026-10-02T10:24:00+01:00",
            deadlineAt: "2026-10-18T23:59:00+01:00",
            description: "Assistance aux personnes âgées non autonomes.",
            requirements: "Diplôme d’aide-soignant et baccalauréat.",
            cvLanguage: "français",
            speciality: "SOINS GÉNÉRAUX AUX PERSONNES ÂGÉES",
            sourceUrl: "https://aneti-international.tn/node/1055923",
            applicationMethod: {
              type: "external_form",
              label: "Formulaire officiel + inscription ANETI requise",
              url: "https://candidatures.aneti.tn/app/inscription/69",
              loginRequired: true,
              note: "Formulaire publié dans la fiche officielle.",
            },
            registrationRequirements: [
              "Être inscrit au bureau de l’emploi et du travail indépendant",
              "Disposer d’un compte candidat ANETI International",
              "Utiliser le numéro CIN pour l’inscription et le nom du fichier CV",
            ],
            checkedAt: "2026-10-03T07:00:00.000Z",
          },
        ],
        meta: {
          period: url.searchParams.get("period") || "week",
          returned: 1,
          totalMatches: 1,
          scanned: 13,
          verifiedAt: "2026-10-03T07:00:00.000Z",
          stale: false,
          sourceUrl: "https://aneti-international.tn/offres",
          methodology: "Lecture des fiches publiques ANETI.",
        },
      });
    }

    if (url.pathname === "/api/atct-opportunities/search" && method === "GET") {
      return this.respond(route, 200, {
        opportunities: [
          {
            id: "offre-de-recrutement-au-canada-de-personnel-educateur-la-petite-enfance-ontario",
            title:
              "Offre de recrutement au Canada de personnel éducateur à la petite enfance – Ontario",
            country: "Canada — Ontario",
            postedAt: "2026-10-02T12:00:00.000Z",
            deadlineAt: "2026-11-01T22:59:00.000Z",
            closedBySource: false,
            category: "job",
            positions: ["Éducatrice ou éducateur à la petite enfance"],
            requirements: "Formation et expérience dans le domaine de la petite enfance.",
            description: "Recrutement international officiel publié par l’ATCT.",
            audience: "Candidats et compétences tunisiennes",
            sourceUrl:
              "https://www.atct.tn/fr/offre-de-recrutement-au-canada-de-personnel-educateur-la-petite-enfance-ontario",
            applicationMethod: {
              type: "external_form",
              label: "Formulaire externe officiel publié par l’ATCT",
              url: "https://connexion-pef.afeseo.ca/je-vis-a-lexterieur-du-canada/",
              email: null,
              loginRequired: false,
              note: "Plateforme : connexion-pef.afeseo.ca",
            },
            requiredDocuments: ["CV", "Diplôme ou qualification"],
            dataQuality: { status: "complete", missingFields: [] },
            checkedAt: "2026-10-03T08:00:00.000Z",
          },
        ],
        meta: {
          period: url.searchParams.get("period") || "week",
          returned: 1,
          totalMatches: 1,
          scanned: 30,
          excludedNotices: 14,
          verifiedAt: "2026-10-03T08:00:00.000Z",
          stale: false,
          sourceUrl: "https://www.atct.tn/fr/avis_ann",
          candidatePortalUrl: "https://www.atct.tn/rh/fr/candidat",
          methodology: "Lecture et classification des avis publics ATCT.",
        },
      });
    }

    if (url.pathname === "/api/algeria-opportunities/search" && method === "GET") {
      return this.respond(route, 200, {
        opportunities: [
          {
            id: "22072",
            title: "Comptable – محاسب(ة)",
            employer: "École privée à Boumerdès",
            wilaya: "Boumerdès",
            wilayas: ["Boumerdès"],
            commune: "Boumerdès",
            location: "Boumerdès",
            positions: ["Comptable – محاسب(ة)"],
            description:
              "📢 إعلان توظيف | Recrutement\n🏫 مدرسة خاصة ببومرداس\n💼 Comptable – محاسب(ة)\n📩 يرجى إرسال السيرة الذاتية عبر البريد الإلكتروني.",
            publishedAt: "2026-10-03T12:25:00.000Z",
            sourceUrl: "https://t.me/rcrdz1/22072",
            applicationMethod: {
              type: "email",
              label: "Candidature par e-mail indiquée dans l’annonce",
              url: "mailto:recrutement.ecole@example.com",
              email: "recrutement.ecole@example.com",
              phone: null,
              loginRequired: false,
              note: "Vérifiez l’adresse dans la publication Telegram avant l’envoi.",
            },
            requiredDocuments: ["CV"],
            dataQuality: { status: "complete", missingFields: [] },
            checkedAt: "2026-10-03T21:30:00.000Z",
          },
        ],
        wilayas: ["Adrar", "Alger", "Boumerdès", "Ouargla"],
        meta: {
          period: url.searchParams.get("period") || "week",
          wilaya: url.searchParams.get("wilaya") || "all",
          returned: 1,
          totalMatches: 1,
          scanned: 26,
          cachedTotal: 42,
          hasMoreHistory: true,
          verifiedAt: "2026-10-03T21:30:00.000Z",
          stale: false,
          sourceUrl: "https://t.me/rcrdz1",
          sourceType: "community_aggregator",
          methodology: "Lecture des publications individuelles publiques.",
          territorialReference: "69 wilayas et 1 541 communes.",
        },
      });
    }

    if (url.pathname === "/api/auth/login" && method === "POST") {
      const credentials = request.postDataJSON() as { username?: string; password?: string };
      const user =
        credentials.password === "e2e-password" ? USERS[credentials.username || ""] : null;
      if (!user) return this.respond(route, 401, { error: "Identifiants de test invalides." });
      const token = tokenFor(user.username);
      this.sessions.set(token, user);
      return this.respond(route, 200, {
        token,
        user: publicTestUser(user),
        expiresAt: Date.now() + 3_600_000,
      });
    }

    if (url.pathname === "/api/auth/session" && method === "GET") {
      const user = this.authenticatedUser(route);
      return user
        ? this.respond(route, 200, { ok: true, user: publicTestUser(user) })
        : this.respond(route, 401, { error: "Session de test expirée." });
    }

    const user = this.authenticatedUser(route);
    if (!user) return this.respond(route, 401, { error: "Session de test absente." });

    if (url.pathname === "/api/telemetry" && method === "POST") {
      const events = (request.postDataJSON() as { events?: unknown[] }).events || [];
      return this.respond(route, 202, { ok: true, stored: events.length, available: true });
    }

    if (url.pathname === "/api/account/sessions" && method === "GET") {
      return this.respond(route, 200, {
        legacySession: false,
        sessions: [
          {
            id: "e2e-session-current-12345",
            deviceLabel: "Navigateur E2E sur Windows",
            createdAt: "2026-09-12T07:00:00.000Z",
            lastSeenAt: "2026-09-12T08:00:00.000Z",
            expiresAt: "2026-09-19T07:00:00.000Z",
            current: true,
          },
        ],
      });
    }

    if (url.pathname.startsWith("/api/admin/")) {
      if (user.role !== "admin")
        return this.respond(route, 403, { error: "Droits administrateur requis." });
      if (url.pathname === "/api/admin/trash" && method === "GET") {
        return this.respond(route, 200, { items: [], retentionDays: 30 });
      }
      if (url.pathname === "/api/admin/users" && method === "GET") {
        return this.respond(route, 200, {
          users: Object.values(USERS).map((managedUser) => ({
            ...publicTestUser(managedUser),
            sessionVersion: 1,
            isPrimary: managedUser.username === "admin",
          })),
        });
      }
      if (url.pathname === "/api/admin/audit" && method === "GET") {
        return this.respond(route, 200, { entries: [] });
      }
      if (url.pathname === "/api/admin/monitoring" && method === "GET") {
        return this.respond(route, 200, {
          generatedAt: new Date().toISOString(),
          available: true,
          health: "healthy",
          retentionDays: 30,
          last24h: { events: 24, javascriptErrors: 0, apiFailures: 0, syncFailures: 0 },
          vitals: [
            { name: "LCP", samples: 5, p75: 1_420, average: 1_310, poor: 0 },
            { name: "INP", samples: 4, p75: 110, average: 95, poor: 0 },
            { name: "CLS", samples: 5, p75: 0.03, average: 0.02, poor: 0 },
            { name: "FCP", samples: 5, p75: 780, average: 720, poor: 0 },
            { name: "TTFB", samples: 5, p75: 190, average: 175, poor: 0 },
          ],
          daily: [],
          opportunitySource: {
            state: "healthy",
            lastAttemptAt: "2026-10-02T03:15:00.000Z",
            lastSuccessAt: "2026-10-02T03:15:01.000Z",
            lastFailureAt: null,
            consecutiveFailures: 0,
            opportunities: 200,
            pagesScanned: 1,
            cacheVersion: 3,
            sourceUrl: "https://youth.europa.eu/go-abroad/volunteering/opportunities_en",
            alerts: [],
          },
          privacy:
            "Aucun nom, CV, courriel, téléphone, adresse IP ou contenu client n’est enregistré.",
        });
      }
      const restoreMatch = url.pathname.match(
        /^\/api\/admin\/backups\/(daily|monthly)\/([^/]+)\/restore$/,
      );
      if (restoreMatch && method === "GET") {
        const period = decodeURIComponent(restoreMatch[2]);
        return this.respond(route, 200, {
          backup: {
            version: 1,
            day: "2026-09-11",
            createdAt: "2026-09-11T03:15:00.000Z",
            profiles: 8,
            photos: 4,
            deletions: 1,
            d1: { available: true, profiles: 8, deletions: 1, systemState: 1 },
          },
          summary: {
            profilesInBackup: 8,
            added: 1,
            overwritten: 7,
            removed: 2,
            objectsToRestore: 13,
          },
          confirmation: `RESTAURER ${period}`,
          safety: "Un point de récupération est créé automatiquement avant toute modification.",
        });
      }
      if (url.pathname === "/api/admin/backups" && method === "GET") {
        return this.respond(route, 200, {
          generatedAt: new Date().toISOString(),
          health: "healthy",
          alerts: [],
          latestStatus: {
            state: "success",
            checkedAt: "2026-09-11T04:15:00.000Z",
            day: "2026-09-11",
            message: "Sauvegarde quotidienne terminée.",
          },
          latestBackup: {
            version: 1,
            day: "2026-09-11",
            createdAt: "2026-09-11T03:15:00.000Z",
            profiles: 8,
            photos: 4,
            deletions: 1,
            d1: { available: true, profiles: 8, deletions: 1, systemState: 1 },
          },
          recentBackups: [
            {
              version: 1,
              day: "2026-09-11",
              createdAt: "2026-09-11T03:15:00.000Z",
              profiles: 8,
              photos: 4,
              deletions: 1,
              d1: { available: true, profiles: 8, deletions: 1, systemState: 1 },
            },
          ],
          recentMonthlyBackups: [
            {
              version: 1,
              kind: "monthly",
              day: "2026-09-11",
              month: "2026-09",
              sourceDay: "2026-09-11",
              createdAt: "2026-09-11T03:15:00.000Z",
              profiles: 8,
              photos: 4,
              deletions: 1,
              d1: { available: true, profiles: 8, deletions: 1, systemState: 1 },
            },
          ],
          recentRecoveryPoints: [],
          storage: {
            clients: { objects: 12, bytes: 120_000 },
            history: { objects: 24, bytes: 240_000 },
            backups: { objects: 18, bytes: 360_000 },
            recovery: { objects: 0, bytes: 0 },
            system: { objects: 4, bytes: 8_000 },
            total: { objects: 58, bytes: 728_000 },
          },
          d1: { available: true, profiles: 8, deletions: 1, indexReady: true },
          schedule: { cron: "15 3 * * *", timezone: "UTC", algerTime: "04:15" },
          retention: { daily: 30, monthly: 12, recoveryPoints: 10 },
        });
      }
      if (url.pathname === "/api/admin/backups" && method === "POST") {
        return this.respond(route, 200, {
          ok: true,
          backup: {
            version: 1,
            day: "2026-09-11",
            createdAt: "2026-09-11T03:15:00.000Z",
            profiles: 8,
            photos: 4,
            deletions: 1,
            skipped: true,
            d1: { available: true, profiles: 8, deletions: 1, systemState: 1 },
          },
        });
      }
      return this.respond(route, 404, { error: "Route administrateur de test inconnue." });
    }

    if (!url.pathname.startsWith("/api/clients")) return route.fallback();

    if (method === "PUT" && this.offlineUsers.has(user.username)) {
      return this.respond(route, 503, { error: "Cloud temporairement indisponible." });
    }

    if (url.pathname === "/api/clients" && method === "GET") {
      const query = (url.searchParams.get("q") || "").trim().toLocaleLowerCase("fr");
      const owner = url.searchParams.get("owner") || "all";
      const status = url.searchParams.get("status") || "all";
      const allProfiles = [...this.profiles.values()];
      const workflowCounts = {
        all: allProfiles.length,
        draft: allProfiles.filter((profile) => (profile.workflowStatus ?? "draft") === "draft")
          .length,
        review: allProfiles.filter((profile) => profile.workflowStatus === "review").length,
        approved: allProfiles.filter((profile) => profile.workflowStatus === "approved").length,
      };
      const profiles = allProfiles
        .filter((profile) => {
          if (owner === "created" && profile.createdBy.username !== user.username) return false;
          if (owner === "updated" && profile.updatedBy.username !== user.username) return false;
          if (
            owner === "involved" &&
            profile.createdBy.username !== user.username &&
            profile.updatedBy.username !== user.username
          )
            return false;
          if (status !== "all" && (profile.workflowStatus ?? "draft") !== status) return false;
          return (
            !query ||
            [profile.id, profile.name, profile.email, profile.phone]
              .join(" ")
              .toLocaleLowerCase("fr")
              .includes(query)
          );
        })
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
      const pageSize = Math.max(
        1,
        Number(url.searchParams.get("pageSize")) || profiles.length || 1,
      );
      const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
      const totalPages = Math.max(1, Math.ceil(profiles.length / pageSize));
      const visibleProfiles =
        url.searchParams.get("scope") === "sync"
          ? profiles
          : profiles.slice((page - 1) * pageSize, page * pageSize);
      return this.respond(route, 200, {
        profiles: visibleProfiles.map((profile) => this.summary(profile)),
        deletedProfiles: [],
        pagination: {
          page,
          pageSize,
          total: profiles.length,
          totalPages,
          hasPrevious: page > 1,
          hasNext: page < totalPages,
        },
        indexSource: "d1",
        workflowCounts,
      });
    }

    if (url.pathname === "/api/clients/workflow-validators" && method === "GET") {
      if (user.role !== "admin" && user.workflowManager !== true)
        return this.respond(route, 403, { error: "Droit de validation requis." });
      return this.respond(route, 200, {
        validators: Object.values(USERS)
          .filter((candidate) => candidate.role === "admin" || candidate.workflowManager === true)
          .map(actor),
      });
    }

    const versionMatch = url.pathname.match(/^\/api\/clients\/([^/]+)\/versions\/(\d+)$/);
    if (versionMatch && method === "GET") {
      const id = decodeURIComponent(versionMatch[1]);
      const revision = Number(versionMatch[2]);
      const profile = this.profileVersions.get(id)?.get(revision);
      return profile
        ? this.respond(route, 200, { id, revision, profile })
        : this.respond(route, 404, { error: "Cette version n’existe plus." });
    }

    const versionsMatch = url.pathname.match(/^\/api\/clients\/([^/]+)\/versions$/);
    if (versionsMatch && method === "GET") {
      const id = decodeURIComponent(versionsMatch[1]);
      const profile = this.profiles.get(id);
      if (!profile) return this.respond(route, 404, { error: "Profil de test introuvable." });
      const versions = [...(this.profileVersions.get(id)?.values() || [])]
        .sort((left, right) => right.revision - left.revision)
        .map((version) => ({
          revision: version.revision,
          updatedAt: version.updatedAt,
          updatedBy: version.updatedBy,
          workflowStatus: version.workflowStatus ?? "draft",
          workflowAssignee: version.workflowAssignee,
          hasPhoto: false,
        }));
      return this.respond(route, 200, {
        id,
        currentRevision: profile.revision,
        versions,
      });
    }

    const assignmentMatch = url.pathname.match(/^\/api\/clients\/([^/]+)\/workflow\/assignment$/);
    if (assignmentMatch && method === "PUT") {
      const id = decodeURIComponent(assignmentMatch[1]);
      const current = this.profiles.get(id);
      if (!current) return this.respond(route, 404, { error: "Profil de test introuvable." });
      if (user.role !== "admin" && user.workflowManager !== true)
        return this.respond(route, 403, { error: "Droit de validation requis." });
      const input = request.postDataJSON() as {
        expectedRevision?: number;
        assigneeUsername?: string;
      };
      if (input.expectedRevision !== current.revision) {
        return this.respond(route, 409, {
          error: "Ce profil a été modifié dans une autre session.",
          code: "CLIENT_PROFILE_CONFLICT",
          current: {
            revision: current.revision,
            updatedAt: current.updatedAt,
            updatedBy: current.updatedBy,
          },
        });
      }
      if ((current.workflowStatus ?? "draft") !== "review")
        return this.respond(route, 422, { error: "CV non attribuable." });
      const assignee = input.assigneeUsername ? USERS[input.assigneeUsername] : undefined;
      if (
        input.assigneeUsername &&
        (!assignee || (assignee.role !== "admin" && assignee.workflowManager !== true))
      )
        return this.respond(route, 422, { error: "Responsable non autorisé." });
      this.revisionClock += 1;
      const timestamp = new Date(Date.UTC(2026, 8, 11, 9, 0, this.revisionClock)).toISOString();
      const updated: StoredProfile = {
        ...structuredClone(current),
        revision: current.revision + 1,
        updatedAt: timestamp,
        updatedBy: actor(user),
        workflowAssignee: assignee ? actor(assignee) : undefined,
        workflowAssignedAt: assignee ? timestamp : undefined,
        workflowAssignedBy: assignee ? actor(user) : undefined,
      };
      this.profiles.set(id, updated);
      const versions = this.profileVersions.get(id) || new Map<number, StoredProfile>();
      versions.set(updated.revision, structuredClone(updated));
      this.profileVersions.set(id, versions);
      return this.respond(route, 200, { ok: true, id, profile: updated });
    }

    const workflowMatch = url.pathname.match(/^\/api\/clients\/([^/]+)\/workflow$/);
    if (workflowMatch && method === "PUT") {
      const id = decodeURIComponent(workflowMatch[1]);
      const current = this.profiles.get(id);
      if (!current) return this.respond(route, 404, { error: "Profil de test introuvable." });
      const input = request.postDataJSON() as {
        status?: "draft" | "review" | "approved";
        expectedRevision?: number;
        comment?: string;
      };
      if (input.expectedRevision !== current.revision) {
        return this.respond(route, 409, {
          error: "Ce profil a été modifié dans une autre session.",
          code: "CLIENT_PROFILE_CONFLICT",
          current: {
            revision: current.revision,
            updatedAt: current.updatedAt,
            updatedBy: current.updatedBy,
          },
        });
      }
      if (!input.status) return this.respond(route, 422, { error: "Statut invalide." });
      const currentStatus = current.workflowStatus ?? "draft";
      const managesWorkflow = user.role === "admin" || user.workflowManager === true;
      const managerTransition =
        managesWorkflow &&
        ((currentStatus === "draft" && input.status === "review") ||
          (currentStatus === "review" &&
            (input.status === "draft" || input.status === "approved")) ||
          (currentStatus === "approved" && input.status === "draft"));
      const editorTransition =
        user.role === "editor" &&
        ((currentStatus === "draft" && input.status === "review") ||
          (currentStatus === "review" && input.status === "draft"));
      if (!managerTransition && !editorTransition) {
        return this.respond(route, 403, { error: "Droits administrateur requis." });
      }
      if (input.status === "draft" && managesWorkflow && !input.comment?.trim()) {
        return this.respond(route, 422, { error: "Commentaire obligatoire." });
      }
      this.revisionClock += 1;
      const timestamp = new Date(Date.UTC(2026, 8, 11, 9, 0, this.revisionClock)).toISOString();
      const updated: StoredProfile = {
        ...structuredClone(current),
        revision: current.revision + 1,
        updatedAt: timestamp,
        updatedBy: actor(user),
        workflowStatus: input.status,
        workflowUpdatedAt: timestamp,
        workflowUpdatedBy: actor(user),
        ...(input.status === "draft" && managesWorkflow
          ? {
              workflowComment: input.comment?.trim(),
              workflowCommentAt: timestamp,
              workflowCommentBy: actor(user),
            }
          : input.status === "approved"
            ? {
                workflowComment: undefined,
                workflowCommentAt: undefined,
                workflowCommentBy: undefined,
              }
            : {}),
        ...(input.status === "review" && currentStatus === "draft"
          ? {
              workflowAssignee: undefined,
              workflowAssignedAt: undefined,
              workflowAssignedBy: undefined,
            }
          : {}),
      };
      this.profiles.set(id, updated);
      const versions = this.profileVersions.get(id) || new Map<number, StoredProfile>();
      versions.set(updated.revision, structuredClone(updated));
      this.profileVersions.set(id, versions);
      return this.respond(route, 200, { ok: true, id, profile: updated });
    }

    const match = url.pathname.match(/^\/api\/clients\/([^/]+)(?:\/(photo))?$/);
    if (!match) return this.respond(route, 404, { error: "Route de test inconnue." });
    const id = decodeURIComponent(match[1]);
    const photo = match[2] === "photo";

    if (photo) {
      return this.respond(route, 404, { error: "Aucune photo dans ce scénario de test." });
    }

    if (method === "GET") {
      const profile = this.profiles.get(id);
      return profile
        ? this.respond(route, 200, profile)
        : this.respond(route, 404, { error: "Profil de test introuvable." });
    }

    if (method === "PUT") {
      const candidate = request.postDataJSON() as StoredProfile;
      const current = this.profiles.get(id);
      if ((current?.workflowStatus ?? "draft") === "approved") {
        return this.respond(route, 423, {
          error: "Ce CV est validé et verrouillé.",
          code: "CLIENT_PROFILE_LOCKED",
          current: {
            revision: current?.revision,
            updatedAt: current?.updatedAt,
            updatedBy: current?.updatedBy,
            workflowStatus: "approved",
          },
        });
      }
      if (current && Number(candidate.revision || 0) !== current.revision) {
        return this.respond(route, 409, {
          error: "Ce profil a été modifié dans une autre session.",
          code: "CLIENT_PROFILE_CONFLICT",
          current: {
            revision: current.revision,
            updatedAt: current.updatedAt,
            updatedBy: current.updatedBy,
          },
        });
      }
      this.revisionClock += 1;
      const timestamp = new Date(Date.UTC(2026, 8, 11, 9, 0, this.revisionClock)).toISOString();
      const committed: StoredProfile = {
        ...structuredClone(candidate),
        id,
        revision: (current?.revision || 0) + 1,
        createdAt: current?.createdAt || timestamp,
        updatedAt: timestamp,
        createdBy: current?.createdBy || actor(user),
        updatedBy: actor(user),
        workflowStatus: current?.workflowStatus ?? candidate.workflowStatus ?? "draft",
        workflowUpdatedAt: current?.workflowUpdatedAt ?? timestamp,
        workflowUpdatedBy: current?.workflowUpdatedBy ?? actor(user),
      };
      this.profiles.set(id, committed);
      const versions = this.profileVersions.get(id) || new Map<number, StoredProfile>();
      versions.set(committed.revision, structuredClone(committed));
      this.profileVersions.set(id, versions);
      return this.respond(route, 200, {
        ok: true,
        profile: {
          revision: committed.revision,
          createdAt: committed.createdAt,
          updatedAt: committed.updatedAt,
          createdBy: committed.createdBy,
          updatedBy: committed.updatedBy,
          workflowStatus: committed.workflowStatus,
          workflowUpdatedAt: committed.workflowUpdatedAt,
          workflowUpdatedBy: committed.workflowUpdatedBy,
        },
      });
    }

    return this.respond(route, 405, { error: "Méthode de test non autorisée." });
  }
}

async function connect(context: BrowserContext, api: SharedClientApi, username: string) {
  await context.route("**/api/**", (route) => api.handle(route));
  const page = await context.newPage();
  await page.goto(`/?login=${username}`);
  await page.getByLabel("Mot de passe").fill("e2e-password");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByRole("button", { name: "Sauvegarder client" })).toBeVisible();
  return page;
}

async function openPersonalDetails(page: Page) {
  const fullName = page.getByPlaceholder("Nom complet");
  if (!(await fullName.isVisible())) {
    await page.getByRole("button", { name: "Déplier Informations personnelles" }).click();
  }
  await expect(fullName).toBeVisible();
}

test("ouvre les opportunités et confirme précisément l’admissibilité tunisienne", async ({
  browser,
}) => {
  const api = new SharedClientApi();
  const context = await browser.newContext();
  try {
    const page = await connect(context, api, "admin");
    await page.getByRole("button", { name: "Opportunités volontariat" }).click();
    const dialog = page.getByRole("main", { name: "Opportunités de volontariat" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Retour à l’accueil" })).toBeVisible();
    await expect(dialog.getByText("Buon cammino", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Tunisie admissible", { exact: true })).toBeVisible();
    await expect(dialog.getByText(/Dernier délai : 04\/10\/2026 23:00/)).toBeVisible();
    await expect(dialog.getByText(/Âge : 18–29 ans/)).toBeVisible();
    await expect(dialog.getByText("Connexion EU Login requise", { exact: true })).toBeVisible();
    await expect(dialog.getByRole("link", { name: /Offre officielle/ })).toHaveAttribute(
      "href",
      "https://youth.europa.eu/solidarity/opportunity/54646_en",
    );
    await dialog.getByRole("button", { name: "Retour à l’accueil" }).click();
    await expect(dialog).toBeHidden();
  } finally {
    await context.close();
  }
});

test("ouvre les opportunités Canada et distingue candidature externe et connexion", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const api = new SharedClientApi();
  const context = await browser.newContext();
  try {
    const page = await connect(context, api, "admin");
    await page.getByRole("button", { name: "Opportunités Canada" }).click();
    const dialog = page.getByRole("main", { name: "Opportunités internationales" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Retour à l’accueil" })).toBeVisible();
    const sourcesNavigation = dialog.getByRole("navigation", {
      name: "Sources d’opportunités",
    });
    await expect(sourcesNavigation).toBeVisible();
    const sourcesNavigationBox = await sourcesNavigation.boundingBox();
    expect(sourcesNavigationBox?.height).toBeLessThanOrEqual(64);
    const sourcesNavigationSize = await sourcesNavigation.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(sourcesNavigationSize.scrollWidth).toBeLessThanOrEqual(
      sourcesNavigationSize.clientWidth + 1,
    );
    await expect(dialog.getByText("senior accountant", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Candidat international vérifié", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Sans compte Indeed", { exact: true })).toBeVisible();
    await expect(dialog.getByText(/Dernier délai : 16 oct. 2026/)).toBeVisible();
    await expect(dialog.getByText("careers@manningelliott.example", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Autres méthodes officielles disponibles")).toBeVisible();
    await expect(dialog.getByText(/Candidature directe Guichet-Emplois/)).toBeVisible();
    await expect(dialog.getByRole("link", { name: /Écrire à l’employeur/ })).toHaveAttribute(
      "href",
      "mailto:careers@manningelliott.example",
    );

    const categorySelect = dialog.getByRole("combobox", {
      name: "Catégorie d’opportunités",
    });
    const sourceMenu = dialog.getByRole("button", {
      name: "Source ou programme",
    });
    const chooseSource = async (name: string) => {
      await sourceMenu.click();
      await page.getByRole("menuitem", { name: new RegExp(name, "i") }).click();
    };
    await expect(categorySelect).toHaveValue("all");
    await expect(sourceMenu).toContainText("Guichet-Emplois Canada");
    await categorySelect.selectOption("jobs");
    await sourceMenu.click();
    const sourcePopup = page.getByRole("menu", { name: "Source ou programme" });
    await expect(sourcePopup).toBeVisible();
    expect(
      await sourcePopup.evaluate((element) =>
        Number.parseInt(getComputedStyle(element).zIndex, 10),
      ),
    ).toBeGreaterThan(100);
    await expect(page.getByRole("menuitem", { name: /Emplois officiels Europe/i })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /Destination Canada/i })).toHaveCount(0);
    await page.getByRole("menuitem", { name: /Emplois officiels Europe/i }).click();
    await expect(dialog.getByText("Make it in Germany", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Work in Finland", { exact: true })).toBeVisible();
    await expect(dialog.getByText("EURES", { exact: true })).toBeVisible();
    await expect(dialog.getByRole("link", { name: /Voir les offres/ })).toHaveAttribute(
      "href",
      "https://www.make-it-in-germany.com/en/working-in-germany/job-listings/job-listings",
    );
    await expect(dialog.getByRole("link", { name: /Rechercher les emplois/ })).toHaveAttribute(
      "href",
      "https://www.workinfinland.com/en/open-jobs/",
    );

    await categorySelect.selectOption("programs");
    await expect(sourceMenu).toContainText("Programmes Canada francophone");
    await expect(dialog.getByText("Mobilité francophone", { exact: true })).toBeVisible();
    await expect(dialog.getByText(/NCLC 5 minimum/)).toBeVisible();
    await expect(dialog.getByText(/code d’exemption C16/)).toBeVisible();
    await expect(dialog.getByText("Programme ouvert", { exact: true })).toBeVisible();
    await expect(dialog.getByRole("link", { name: /Trouver les employeurs/ })).toHaveAttribute(
      "href",
      /rural-franco-pilots\/franco-immigration\/job-offer\.html/,
    );

    await categorySelect.selectOption("all");

    await chooseSource("Indeed Canada");
    await expect(dialog.getByText("Recherche Indeed conforme et durable")).toBeVisible();
    await expect(dialog.getByRole("link", { name: /Ouvrir Indeed/ })).toHaveAttribute(
      "href",
      /ca\.indeed\.com\/jobs\?/,
    );

    await chooseSource("Destination Canada");
    await expect(dialog.getByText("Destination Canada Forum Mobilité 2026")).toBeVisible();
    await expect(dialog.getByText("10 et 11 décembre 2026")).toBeVisible();
    await expect(
      dialog.getByRole("link", { name: /Vérifier l’inscription candidat/ }),
    ).toHaveAttribute("href", /canada\.ca\/fr\/.*\/destination-canada\/candidats\.html/);

    await chooseSource("Île-du-Prince-Édouard");
    const peiCard = dialog
      .getByRole("article")
      .filter({ hasText: "Île-du-Prince-Édouard — EOI et recrutement international" });
    await expect(
      peiCard.getByText(/déclaration d’intérêt.*n’est ni une candidature/),
    ).toBeVisible();
    await expect(peiCard.getByText(/Santé, métiers spécialisés et petite enfance/)).toBeVisible();
    await expect(peiCard.getByText(/L’employeur paie tout.*est faux/)).toBeVisible();
    await expect(
      peiCard.getByRole("link", { name: /Créer le profil EOI officiel/ }),
    ).toHaveAttribute("href", "https://eoi.princeedwardisland.ca/ieoi/register/register");
    await expect(
      peiCard.getByRole("link", { name: /Vérifier l’admissibilité hors Canada/ }),
    ).toHaveAttribute(
      "href",
      "https://www.princeedwardisland.ca/en/information/office-of-immigration/skilled-workers-outside-canada",
    );

    await chooseSource("Nouveau-Brunswick");
    const nbCard = dialog
      .getByRole("article")
      .filter({ hasText: "Nouveau-Brunswick — compte INB et voies 2026" });
    await expect(nbCard.getByText(/ne garantit aucune invitation/)).toBeVisible();
    await expect(nbCard.getByText(/santé, l’éducation et la construction/)).toBeVisible();
    await expect(nbCard.getByText(/hébergement et la restauration.*SCIAN 72/)).toBeVisible();
    await expect(
      nbCard.getByRole("link", { name: /Créer ou ouvrir le compte INB/ }),
    ).toHaveAttribute("href", "https://www.inb.gnb.ca/");
    await expect(nbCard.getByRole("link", { name: /Restrictions en vigueur/ })).toHaveAttribute(
      "href",
      "https://www.gnb.ca/en/topic/family-home-community/immigration/important-notices.html",
    );

    await chooseSource("ANETI International");
    await expect(dialog.getByText("Opérateur socio-sanitaire", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Inscription ANETI requise", { exact: true })).toBeVisible();
    await expect(dialog.getByText(/Dernier délai : 18 oct. 2026/)).toBeVisible();
    await expect(dialog.getByText(/numéro CIN/)).toBeVisible();
    await expect(
      dialog.getByRole("link", { name: /Ouvrir le formulaire officiel/ }),
    ).toHaveAttribute("href", "https://candidatures.aneti.tn/app/inscription/69");

    await chooseSource("ATCT Tunisia");
    await expect(dialog.getByText(/personnel éducateur à la petite enfance/)).toBeVisible();
    await expect(dialog.getByText("Source publique ATCT vérifiée", { exact: true })).toBeVisible();
    await expect(dialog.getByText(/Dernier délai : 01 nov. 2026/)).toBeVisible();
    await expect(dialog.getByText(/14 avis hors emploi écarté/)).toBeVisible();
    await expect(
      dialog.getByRole("link", { name: /Ouvrir le formulaire officiel/ }),
    ).toHaveAttribute("href", "https://connexion-pef.afeseo.ca/je-vis-a-lexterieur-du-canada/");

    await chooseSource("Opportunités Algérie");
    await expect(dialog.getByRole("heading", { name: "Comptable – محاسب(ة)" })).toBeVisible();
    await expect(
      dialog.getByText("Source communautaire à vérifier", { exact: true }),
    ).toBeVisible();
    await expect(dialog.getByLabel("Wilaya Algérie")).toBeVisible();
    await expect(dialog.getByText("recrutement.ecole@example.com", { exact: true })).toBeVisible();
    await expect(dialog.getByRole("link", { name: /Écrire pour postuler/ })).toHaveAttribute(
      "href",
      "mailto:recrutement.ecole@example.com",
    );
    await expect(dialog.getByRole("link", { name: /Vérifier sur Telegram/ })).toHaveAttribute(
      "href",
      "https://t.me/rcrdz1/22072",
    );
    await dialog.getByRole("button", { name: "Plus d’infos" }).click();
    const algeriaDetails = page.getByRole("dialog", { name: /Comptable/ });
    await expect(algeriaDetails).toBeVisible();
    await expect(algeriaDetails.getByText("Informations complètes de l’offre")).toBeVisible();
    await expect(algeriaDetails.locator('[dir="rtl"][lang="ar"]').first()).toBeVisible();
    await expect(algeriaDetails.getByRole("link", { name: /Vérifier sur Telegram/ })).toBeVisible();
    await algeriaDetails.getByRole("button", { name: "Retour aux offres" }).click();
    await expect(algeriaDetails).toBeHidden();
    await expect(dialog.getByText("Lire la publication originale")).toHaveCount(0);

    await chooseSource("Opportunités Italie");
    const italyCard = dialog.getByRole("article").filter({ hasText: "Decreto Flussi 2027" });
    await expect(italyCard.getByText("Decreto Flussi 2027 — 165 850 quotas légaux")).toBeVisible();
    await expect(italyCard.getByText(/ce ne sont pas 165 850 contrats/)).toBeVisible();
    await expect(italyCard.getByText("89 000", { exact: true })).toBeVisible();
    await expect(italyCard.getByText("76 200", { exact: true })).toBeVisible();
    await expect(italyCard.getByText("Tunisie", { exact: true })).toBeVisible();
    await expect(italyCard.getByText("Algérie", { exact: true })).toBeVisible();
    await expect(italyCard.getByText("12 janvier 2027 · 09:00", { exact: true })).toBeVisible();
    await expect(italyCard.getByText("18 février 2027 · 09:00", { exact: true })).toBeVisible();
    await expect(
      italyCard.getByText(/Le candidat ne demande pas lui-même le Nulla Osta/),
    ).toBeVisible();
    await expect(italyCard.getByRole("link", { name: /Rechercher sur EURES/ })).toHaveAttribute(
      "href",
      "https://eures.europa.eu/jobseekers_it",
    );
    await expect(italyCard.getByRole("link", { name: /Ouvrir le portail ALI/ })).toHaveAttribute(
      "href",
      "https://portaleservizi.dlci.interno.it/AliSportello/ali/home.htm",
    );
    await dialog.getByRole("button", { name: "Retour à l’accueil" }).click();
    await expect(dialog).toBeHidden();
  } finally {
    await context.close();
  }
});

test("masque les liens Telegram aux profils non administrateurs", async ({ browser }) => {
  const api = new SharedClientApi();
  const context = await browser.newContext();
  try {
    const page = await connect(context, api, "lecteur");
    await page.getByRole("button", { name: "Opportunités Canada" }).click();
    const workspace = page.getByRole("main", { name: "Opportunités internationales" });
    await workspace.getByRole("button", { name: "Source ou programme" }).click();
    await page.getByRole("menuitem", { name: /Opportunités Algérie/i }).click();
    await expect(workspace.getByRole("button", { name: "Plus d’infos" })).toBeVisible();
    await expect(workspace.getByRole("link", { name: /Telegram/ })).toHaveCount(0);
    await workspace.getByRole("button", { name: "Plus d’infos" }).click();
    const details = page.getByRole("dialog", { name: /Comptable/ });
    await expect(details).toBeVisible();
    await expect(details.getByRole("link", { name: /Telegram/ })).toHaveCount(0);
    await expect(details.getByRole("link", { name: /Envoyer la candidature/ })).toHaveAttribute(
      "href",
      "mailto:recrutement.ecole@example.com",
    );
  } finally {
    await context.close();
  }
});

test("sélectionne une équivalence officielle CNP dans le formulaire", async ({ browser }) => {
  const api = new SharedClientApi();
  const context = await browser.newContext();
  try {
    const page = await connect(context, api, "admin");
    await openPersonalDetails(page);
    await page.getByPlaceholder("Titre du poste").fill("Développeur logiciel");
    const nocSelector = page.getByRole("combobox", {
      name: /Rechercher un code ou un intitulé CNP/,
    });
    await expect(nocSelector).toBeVisible();
    await nocSelector.click();

    const nocSearch = page.getByPlaceholder(/Code CNP ou métier/);
    await expect(nocSearch).toBeVisible();
    await nocSearch.fill("21232");

    const nocOption = page.locator("[cmdk-item]").filter({ hasText: "21232" }).first();
    await expect(nocOption).toContainText(/Développeurs.*programmeurs.*de logiciels/);
    await nocOption.click();

    await expect(
      page.getByRole("combobox", { name: /21232.*Développeurs.*programmeurs.*de logiciels/ }),
    ).toBeVisible();
    await expect(
      page.getByText(/FEER 1 · Diplôme universitaire généralement requis/),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /CNP 2021 v1.0 · source officielle/ }),
    ).toHaveAttribute("href", /statcan\.gc\.ca\/fr\/sujets\/norme\/cnp\/2021/);
  } finally {
    await context.close();
  }
});

test("extrait le XML embarqué d’un PDF Europass et préremplit le formulaire", async ({
  browser,
}) => {
  const api = new SharedClientApi();
  const context = await browser.newContext();

  try {
    const page = await connect(context, api, "admin");
    const europassInput = page.locator('input[type="file"][multiple][accept*="application/pdf"]');
    await europassInput.setInputFiles("test-data/europass/Europass-CV-Amine-Bensalem-FR.pdf");

    await expect(page.getByRole("status").filter({ hasText: /Europass importé/ })).toContainText(
      "FR",
    );
    const importReport = page.getByRole("status", { name: "Rapport d’import Europass" });
    await expect(importReport.getByText(/PDF officiel avec XML embarqué/)).toBeHidden();
    await importReport.getByRole("button", { name: "Voir le rapport" }).click();
    await expect(importReport.getByText(/PDF officiel avec XML embarqué/)).toBeVisible();
    await importReport.getByRole("button", { name: "Réduire" }).click();
    await expect(importReport.getByText(/PDF officiel avec XML embarqué/)).toBeHidden();
    await importReport.getByRole("button", { name: "Fermer le rapport d’import Europass" }).click();
    await expect(importReport).toBeHidden();
    await expect(page.getByRole("button", { name: /Importer CV Europass/ })).toBeVisible();
    await openPersonalDetails(page);
    await expect(page.getByPlaceholder("Nom complet")).toHaveValue("Amine Bensalem");
    await expect(page.getByPlaceholder("name@example.com")).toHaveValue(
      "amine.bensalem@example.com",
    );
    await expect(page.getByAltText("Aperçu de la photo du profil")).toBeVisible();
    await expect(page.getByLabel("Modèle", { exact: true })).toHaveValue("europass");

    const objectiveSection = page.locator("#cv-editor-section-objective");
    const objectiveEditor = objectiveSection.getByRole("textbox", {
      name: "profil professionnel",
      exact: true,
    });
    if (!(await objectiveEditor.isVisible())) {
      await objectiveSection.getByRole("button", { name: /^Déplier / }).click();
    }
    await expect(objectiveEditor).toContainText("développement web");
    await expect(objectiveEditor).not.toContainText("<p>");
    await expect(objectiveEditor).not.toContainText("<strong>");

    const skillsSection = page.locator("#cv-editor-section-skills");
    const skillsEditor = skillsSection.getByRole("textbox", {
      name: "compétences clés",
      exact: true,
    });
    if (!(await skillsEditor.isVisible())) {
      await skillsSection.getByRole("button", { name: /^Déplier / }).click();
    }
    await expect(skillsEditor).toContainText("Centrifugation");
    await expect(skillsEditor).toContainText("Microscopie");
    await expect(skillsEditor).toContainText("Microsoft PowerPoint");
    await expect(skillsEditor).toContainText("Zoom");
  } finally {
    await context.close();
  }
});

test("importe ensemble les versions française et anglaise du même profil Europass", async ({
  browser,
}) => {
  const api = new SharedClientApi();
  const context = await browser.newContext();

  try {
    const page = await connect(context, api, "admin");
    const frenchXml = await readFile(
      "test-data/europass/Europass-CV-Amine-Bensalem-FR.xml",
      "utf8",
    );
    const englishXml = frenchXml
      .replace('languageCode="fr"', 'languageCode="en"')
      .replace(
        "Développeur logiciel full-stack spécialisé en applications web modernes.",
        "Full-stack software developer specialized in modern web applications.",
      );
    const europassInput = page.locator('input[type="file"][multiple][accept*="application/pdf"]');
    await europassInput.setInputFiles([
      {
        name: "Europass-CV-Amine-Bensalem-FR.xml",
        mimeType: "application/xml",
        buffer: Buffer.from(frenchXml),
      },
      {
        name: "Europass-CV-Amine-Bensalem-EN.xml",
        mimeType: "application/xml",
        buffer: Buffer.from(englishXml),
      },
    ]);

    await expect(page.getByRole("status").filter({ hasText: /Europass importé/ })).toContainText(
      "FR + EN",
    );
    await page.getByRole("button", { name: /Langue du document : Français/ }).click();
    await page.getByRole("menuitem").filter({ hasText: "English" }).click();
    await openPersonalDetails(page);
    await expect(page.getByPlaceholder("Nom complet")).toHaveValue("Amine Bensalem");
    await expect(page.getByLabel("Modèle", { exact: true })).toHaveValue("europass");
  } finally {
    await context.close();
  }
});

test("les outils lourds sont chargés uniquement lorsqu’ils deviennent utiles", async ({
  browser,
}) => {
  const api = new SharedClientApi();
  const context = await browser.newContext();

  try {
    const page = await connect(context, api, "admin");
    const resourcesBeforeInteraction = await page.evaluate(() =>
      performance.getEntriesByType("resource").map((entry) => entry.name),
    );
    expect(resourcesBeforeInteraction.some((url) => url.includes("preview-control-dock"))).toBe(
      false,
    );
    expect(resourcesBeforeInteraction.some((url) => url.includes("cv-experience-workspace"))).toBe(
      false,
    );

    await page.getByRole("button", { name: "Déplier Expérience professionnelle" }).click();
    await expect(page.getByRole("button", { name: /Modifier l’expérience/ }).first()).toBeVisible();

    await page.getByRole("button", { name: "Afficher l’aperçu" }).click();
    await expect(page.getByRole("toolbar", { name: "Outils de l’aperçu" })).toBeVisible();
    await expect(page.getByLabel(/Page 1 sur/)).toBeVisible({ timeout: 30_000 });

    const resourcesAfterInteraction = await page.evaluate(() =>
      performance.getEntriesByType("resource").map((entry) => entry.name),
    );
    expect(resourcesAfterInteraction.some((url) => url.includes("preview-control-dock"))).toBe(
      true,
    );
    expect(resourcesAfterInteraction.some((url) => url.includes("cv-experience-workspace"))).toBe(
      true,
    );
    expect(resourcesAfterInteraction.some((url) => url.includes("document-pdf"))).toBe(true);
  } finally {
    await context.close();
  }
});

test("le profil lecture seule masque les actions interdites", async ({ browser }) => {
  const api = new SharedClientApi();
  const context = await browser.newContext();
  try {
    const page = await connect(context, api, "lecteur");
    await expect(page.getByText(/Mode lecture seule : consultation/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Sauvegarder client" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Assistant IA" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Commandes" })).toHaveCount(0);
    await page.getByRole("button", { name: "Base de données", exact: true }).click();
    const database = page.getByRole("main", { name: /Base de données clients/ });
    await expect(database.getByText(/lecture seule/).first()).toBeVisible();
    await expect(
      database.getByRole("button").filter({ hasText: "Actualiser la base" }),
    ).toBeVisible();
    await expect(database.getByRole("button", { name: "Synchroniser maintenant" })).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test("les espaces de travail principaux s’ouvrent en page complète et reviennent à l’accueil", async ({
  browser,
}) => {
  const api = new SharedClientApi();
  const context = await browser.newContext();
  try {
    const page = await connect(context, api, "admin");
    const workspaces = [
      { trigger: "Assistant IA", title: /Assistant IA d’import JSON/ },
      { trigger: "Prompte", title: /Prompte maître CV/ },
      { trigger: "Paramètres IA", title: /Paramètres IA simplifiés/ },
      { trigger: "Commandes", title: /Commandes CV PRO TEAM/ },
      { trigger: "Base de données", title: /Base de données clients/ },
      { trigger: "Administrateur E2E", title: /Paramètres du compte/ },
    ];

    for (const workspace of workspaces) {
      await page.getByRole("button", { name: workspace.trigger, exact: true }).click();
      const fullPage = page.getByRole("main", { name: workspace.title });
      await expect(fullPage).toBeVisible();
      await fullPage.getByRole("button", { name: "Retour à l’accueil" }).click();
      await expect(fullPage).toBeHidden();
    }
  } finally {
    await context.close();
  }
});

test("deux navigateurs partagent un client et protègent une modification concurrente", async ({
  browser,
}) => {
  const api = new SharedClientApi();
  const adminContext = await browser.newContext();
  const editorContext = await browser.newContext();

  try {
    const adminPage = await connect(adminContext, api, "admin");
    await expect(adminPage.getByText("Travail enregistré")).toBeVisible();
    await adminPage.getByRole("button", { name: "Administrateur E2E" }).click();
    const accountSettings = adminPage.getByRole("main", { name: /Paramètres du compte/ });
    await expect(accountSettings.getByText("Santé de l’application")).toBeVisible();
    await expect(accountSettings.getByText("Fonctionnement sain")).toBeVisible();
    await expect(accountSettings.getByText("Web Vitals réels — 75e percentile")).toBeVisible();
    await expect(accountSettings.getByText("Supervision D1 et R2")).toBeVisible();
    await expect(accountSettings.getByText("Sauvegardes opérationnelles")).toBeVisible();
    await expect(accountSettings.getByText("8 profils", { exact: true })).toBeVisible();
    await accountSettings.getByRole("button", { name: "Sauvegarder maintenant" }).click();
    await expect(accountSettings.getByRole("status")).toContainText("existe déjà");
    await accountSettings.getByRole("button", { name: "Préparer" }).first().click();
    await expect(accountSettings.getByText("Restaurer la sauvegarde 2026-09-11")).toBeVisible();
    const restoreButton = accountSettings.getByRole("button", {
      name: "Restaurer la base clients",
    });
    await expect(restoreButton).toBeDisabled();
    await accountSettings.getByLabel(/Saisissez exactement/).fill("RESTAURER 2026-09-11");
    await expect(restoreButton).toBeEnabled();
    await accountSettings.getByRole("button", { name: "Annuler" }).click();
    await accountSettings.getByRole("button", { name: "Fermer" }).click();

    await adminPage.getByRole("button", { name: "Exemple" }).click();
    await openPersonalDetails(adminPage);
    await adminPage.getByPlaceholder("Nom complet").fill("Client E2E partagé");
    await adminPage.getByPlaceholder("+1 514 000 0000").fill("+213 555 100 100");
    await adminPage.getByRole("button", { name: "Sauvegarder client" }).click();

    await expect.poll(() => api.profiles.size).toBe(1);
    const profileId = [...api.profiles.keys()][0];
    await expect(
      adminPage.getByText(/Nouveau profil sauvegardé localement et dans R2/),
    ).toBeVisible();
    expect(api.profiles.get(profileId)?.createdBy.username).toBe("admin");
    await adminPage.getByRole("button", { name: "Base de données", exact: true }).click();
    const adminDatabase = adminPage.getByRole("main", { name: /Base de données clients/ });
    await expect(adminDatabase.getByText("Corbeille sécurisée")).toBeVisible();
    await expect(adminDatabase.getByText("La corbeille est vide.")).toBeVisible();
    await adminDatabase.getByRole("button", { name: "Retour à l’accueil" }).click();
    await expect(adminPage.getByText("Travail enregistré")).toBeVisible();
    await adminPage.reload();
    await expect(adminPage.getByRole("button", { name: "Sauvegarder", exact: true })).toBeVisible();
    await openPersonalDetails(adminPage);
    await expect(adminPage.getByPlaceholder("Nom complet")).toHaveValue("Client E2E partagé");
    await expect(adminPage.getByPlaceholder("+1 514 000 0000")).toHaveValue("+213 555 100 100");

    const editorPage = await connect(editorContext, api, "editeur");
    await editorPage.getByRole("button", { name: "Base de données", exact: true }).click();
    const database = editorPage.getByRole("main", { name: /Base de données clients/ });
    await expect(database).toBeVisible();
    await database.getByRole("button", { name: "Synchroniser maintenant" }).click();
    await expect(database.getByRole("status")).toContainText("1 récupéré(s)");

    const profileRow = database.locator("article").filter({ hasText: "Client E2E partagé" });
    await expect(profileRow).toContainText("Créé par Administrateur E2E (admin)");
    await profileRow.getByRole("button", { name: "Ouvrir et modifier" }).click();
    await openPersonalDetails(editorPage);
    await editorPage.getByPlaceholder("+1 514 000 0000").fill("+213 555 200 200");
    await editorPage.getByRole("button", { name: "Sauvegarder", exact: true }).click();

    await expect.poll(() => api.profiles.get(profileId)?.revision).toBe(2);
    expect(api.profiles.get(profileId)?.phone).toBe("+213 555 200 200");
    expect(api.profiles.get(profileId)?.updatedBy.username).toBe("editeur");

    await editorPage.getByRole("button", { name: "Base de données", exact: true }).click();
    const historyDatabase = editorPage.getByRole("main", { name: /Base de données clients/ });
    const historyRow = historyDatabase.locator("article").filter({ hasText: "Client E2E partagé" });
    await historyRow.getByRole("button", { name: "Historique" }).click();
    await expect(historyRow.getByText("Timeline des modifications")).toBeVisible();
    await expect(historyRow.getByLabel("Version de départ")).toHaveValue("1");
    await expect(historyRow.getByLabel("Version d’arrivée")).toHaveValue("2");
    await historyRow.getByRole("button", { name: "Comparer", exact: true }).click();
    const comparison = historyRow.getByRole("region", { name: "Résultat de la comparaison" });
    await expect(comparison.getByText("Révision 1 → révision 2")).toBeVisible();
    await expect(comparison.getByText("CV › Français › Téléphone", { exact: true })).toBeVisible();
    await expect(comparison.getByText("+213 555 100 100", { exact: true })).toBeVisible();
    await expect(comparison.getByText("+213 555 200 200", { exact: true })).toBeVisible();
    await historyDatabase.getByRole("button", { name: "Retour à l’accueil" }).click();

    api.offlineUsers.add("editeur");
    await editorPage.getByPlaceholder("+1 514 000 0000").fill("+213 555 300 300");
    await editorPage.getByRole("button", { name: "Sauvegarder", exact: true }).click();
    await expect(editorPage.getByText("1 cloud en attente")).toBeVisible();
    api.offlineUsers.delete("editeur");
    await editorPage.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect.poll(() => api.profiles.get(profileId)?.revision).toBe(3);
    await expect(editorPage.getByText("1 cloud en attente")).toBeHidden();
    expect(api.profiles.get(profileId)?.phone).toBe("+213 555 300 300");

    await adminPage.getByPlaceholder("+1 514 000 0000").fill("+213 555 999 999");
    await adminPage.getByRole("button", { name: "Sauvegarder", exact: true }).click();
    const conflictStatus = adminPage.getByRole("status").filter({ hasText: /^Conflit$/ });
    await expect(conflictStatus).toBeVisible();
    await expect(conflictStatus).toHaveAttribute(
      "title",
      /Conflit avec la révision 3 modifiée par Éditeur E2E/,
    );
    expect(api.profiles.get(profileId)?.phone).toBe("+213 555 300 300");
    expect(api.profiles.get(profileId)?.revision).toBe(3);

    await editorPage.getByRole("button", { name: "Base de données", exact: true }).click();
    const editorWorkflowDatabase = editorPage.getByRole("main", {
      name: /Base de données clients/,
    });
    const editorWorkflowRow = editorWorkflowDatabase
      .locator("article")
      .filter({ hasText: "Client E2E partagé" });
    await expect(editorWorkflowRow.getByText("Brouillon", { exact: true })).toBeVisible();
    editorPage.once("dialog", (dialog) => dialog.accept());
    await editorWorkflowRow.getByRole("button", { name: "Soumettre" }).click();
    await expect.poll(() => api.profiles.get(profileId)?.workflowStatus).toBe("review");
    await expect(editorWorkflowRow.getByText("À valider", { exact: true })).toBeVisible();
    await expect(editorWorkflowDatabase.getByRole("button", { name: /1 À valider/ })).toBeVisible();
    await editorWorkflowRow
      .getByLabel("Responsable de validation pour Client E2E partagé")
      .selectOption("editeur");
    await expect
      .poll(() => api.profiles.get(profileId)?.workflowAssignee?.username)
      .toBe("editeur");
    await expect(editorWorkflowRow.getByText(/Responsable : Éditeur E2E/)).toBeVisible();
    editorPage.once("dialog", (dialog) => dialog.accept());
    await editorWorkflowRow.getByRole("button", { name: "Valider" }).click();
    await expect.poll(() => api.profiles.get(profileId)?.workflowStatus).toBe("approved");
    await expect(editorWorkflowRow.getByText("Validé", { exact: true })).toBeVisible();
    await editorWorkflowDatabase.getByRole("button", { name: "Retour à l’accueil" }).click();

    await expect(editorPage.getByText(/CV validé et verrouillé/).first()).toBeVisible();
    await expect(
      editorPage.getByRole("button", { name: "Sauvegarder", exact: true }),
    ).toBeDisabled();
    expect(api.profiles.get(profileId)?.phone).toBe("+213 555 300 300");

    await editorPage.getByRole("button", { name: "Base de données", exact: true }).click();
    const reopenDatabase = editorPage.getByRole("main", { name: /Base de données clients/ });
    const reopenRow = reopenDatabase.locator("article").filter({ hasText: "Client E2E partagé" });
    editorPage.once("dialog", async (dialog) => {
      await dialog.accept("Mettre à jour les coordonnées du client.");
    });
    await reopenRow.getByRole("button", { name: "Rouvrir" }).click();
    await expect.poll(() => api.profiles.get(profileId)?.workflowStatus).toBe("draft");
    await expect(reopenRow.getByText("Brouillon", { exact: true })).toBeVisible();
    await expect(reopenRow.getByText(/Mettre à jour les coordonnées du client\./)).toBeVisible();
    await reopenDatabase.getByRole("button", { name: "Retour à l’accueil" }).click();
    await editorPage.getByPlaceholder("+1 514 000 0000").fill("+213 555 888 888");
    await editorPage.getByRole("button", { name: "Sauvegarder", exact: true }).click();
    await expect.poll(() => api.profiles.get(profileId)?.phone).toBe("+213 555 888 888");
  } finally {
    await adminContext.close();
    await editorContext.close();
  }
});
