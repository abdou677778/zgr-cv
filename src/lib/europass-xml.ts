import type {
  CV,
  Education,
  EuropassEducationDetails,
  EuropassExperienceDetails,
  EuropassLanguageProfile,
  EuropassProfile,
  Experience,
  Formation,
} from "./cv-types";
import { type DocumentLanguage } from "./document-language";
import { emptyCV, emptyEuropassProfile, newId } from "./cv-types";
import { strToU8, zipSync } from "fflate";
import { processProfilePhoto, profilePhotoDataUrlForPdf } from "./profile-photo";

const ISO_639_2: Record<string, string> = {
  fr: "fre",
  en: "eng",
  es: "spa",
  de: "ger",
  it: "ita",
  zh: "chi",
  ar: "ara",
  kab: "kab",
};

function escapeXml(unsafe: string): string {
  if (!unsafe) return "";
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function parseName(fullName: string): { firstName: string; lastName: string } {
  const clean = (fullName || "").trim();
  if (!clean) return { firstName: "", lastName: "" };
  const parts = clean.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };

  if (parts[0] === parts[0].toUpperCase() && parts[0].length > 1) {
    return {
      lastName: parts[0],
      firstName: parts.slice(1).join(" "),
    };
  }

  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts[parts.length - 1],
  };
}

const MONTHS: Array<[RegExp, string]> = [
  [/jan(?:v(?:ier)?)?|january|enero|januar|gennaio|一月|يناير/i, "01"],
  [/f[eé]vr(?:ier)?|february|febrero|februar|febbraio|二月|فبراير/i, "02"],
  [/mars|march|marzo|m[aä]rz|三月|مارس/i, "03"],
  [/avr(?:il)?|april|abril|四月|أبريل/i, "04"],
  [/mai|may|mayo|maggio|五月|مايو/i, "05"],
  [/juin|june|junio|juni|giugno|六月|يونيو/i, "06"],
  [/juil(?:let)?|july|julio|juli|luglio|七月|يوليو/i, "07"],
  [/[aâ]o[uû]t|august|agosto|八月|أغسطس/i, "08"],
  [/sept(?:embre)?|september|septiembre|settembre|九月|سبتمبر/i, "09"],
  [/oct(?:obre)?|october|octubre|oktober|ottobre|十月|أكتوبر/i, "10"],
  [/nov(?:embre)?|november|noviembre|十一月|نوفمبر/i, "11"],
  [/d[eé]c(?:embre)?|december|diciembre|dezember|dicembre|十二月|ديسمبر/i, "12"],
];

function isoDate(value: string): string {
  const source = (value || "").trim();
  if (!source) return "";
  const iso = source.match(/\b((?:19|20)\d{2})[/-](\d{1,2})[/-](\d{1,2})\b/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const year = source.match(/\b((?:19|20)\d{2})\b/)?.[1];
  if (!year) return "";
  const month = MONTHS.find(([pattern]) => pattern.test(source))?.[1] || "01";
  const dayCandidate = source.match(/\b([0-2]?\d|3[01])\b/)?.[1];
  const day = dayCandidate && dayCandidate !== year ? dayCandidate.padStart(2, "0") : "01";
  return `${year}-${month}-${day}`;
}

function parseDateRange(value: string): { start: string; end: string; current: boolean } {
  const source = (value || "").trim();
  if (!source) return { start: "", end: "", current: false };
  const current = /présent|present|current|actuel|heute|oggi|actual|至今|الآن|حالي/i.test(source);
  const matches = Array.from(source.matchAll(/\b(?:19|20)\d{2}\b/g));
  if (!matches.length) return { start: "", end: "", current };
  const firstEnd = (matches[0].index || 0) + matches[0][0].length;
  const start = isoDate(source.slice(0, firstEnd));
  const end = current
    ? ""
    : matches.length > 1
      ? isoDate(source.slice(firstEnd))
      : start;
  return { start, end, current };
}

function countryCodeFromText(value: string): string {
  const source = (value || "").toLowerCase();
  if (/canada|kanada|كندا|加拿大/.test(source)) return "ca";
  if (/alg[eé]rie|algeria|argelia|algerien|algeria|الجزائر|阿尔及利亚/.test(source)) return "dz";
  if (/france|frankreich|francia|فرنسا|法国/.test(source)) return "fr";
  if (/germany|deutschland|allemagne|alemania|germania|ألمانيا|德国/.test(source)) return "de";
  if (/spain|espagne|españa|spanien|spagna|إسبانيا|西班牙/.test(source)) return "es";
  if (/italy|italie|italia|italien|إيطاليا|意大利/.test(source)) return "it";
  if (/china|chine|china|الصين|中国/.test(source)) return "cn";
  return "";
}

function cleanCountryCode(value: string): string {
  const code = (value || "").trim().toLowerCase();
  return /^[a-z]{2}$/.test(code) ? code : "";
}

function normalizeGender(value: string): string {
  const normalized = (value || "").trim();
  return /^(male|female|other|notSpecified)$/.test(normalized) ? normalized : "";
}

function parseCefrLevel(value: string): EuropassLanguageProfile["listening"] {
  const level = (value || "").trim().toUpperCase();
  return /^(A1|A2|B1|B2|C1|C2)$/.test(level)
    ? (level as EuropassLanguageProfile["listening"])
    : "";
}

function richList(items: string[]): string {
  if (!items.length) return "";
  return `<ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul>`;
}

function deterministicId(seed: string): string {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `ZGR-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function telephoneParts(phone: string, explicitCountryCode: string) {
  const explicit = explicitCountryCode.replace(/\D/g, "");
  const source = (phone || "").trim();
  const detected = source.match(/^\s*\+(\d{1,3})/)?.[1] || "";
  const countryDialing = explicit || detected;
  let dialNumber = source.replace(/\D/g, "");
  if (countryDialing && dialNumber.startsWith(countryDialing)) {
    dialNumber = dialNumber.slice(countryDialing.length);
  }
  return { countryDialing, dialNumber };
}

function experienceDetails(cv: CV, id: string): EuropassExperienceDetails | undefined {
  return cv.europass?.experience_details.find((item) => item.id === id);
}

function educationDetails(cv: CV, id: string): EuropassEducationDetails | undefined {
  return cv.europass?.education_details.find((item) => item.id === id);
}

function renderLanguage(language: EuropassLanguageProfile): string {
  const dimensions: Array<[string, string]> = [
    ["CEF-Understanding-Listening", language.listening],
    ["CEF-Understanding-Reading", language.reading],
    ["CEF-Speaking-Interaction", language.spoken_interaction],
    ["CEF-Speaking-Production", language.spoken_production],
    ["CEF-Writing-Production", language.writing],
  ];
  const scores = dimensions
    .filter(([, score]) => /^(A1|A2|B1|B2|C1|C2)$/.test(score))
    .map(
      ([type, score]) => `<eures:CompetencyDimension>
          <hr:CompetencyDimensionTypeCode>${type}</hr:CompetencyDimensionTypeCode>
          <eures:Score><hr:ScoreText>${score}</hr:ScoreText></eures:Score>
        </eures:CompetencyDimension>`,
    )
    .join("");
  if (!scores || language.mother_tongue) return "";
  const code = ISO_639_2[language.code] || language.code;
  const normalCode = /^[a-z]{3}$/i.test(code);
  return `<PersonCompetency>
        <CompetencyID schemeName="${normalCode ? "NORMAL" : "FREE_TEXT"}">${escapeXml(
          normalCode ? code.toLowerCase() : language.label,
        )}</CompetencyID>
        <hr:TaxonomyID>language</hr:TaxonomyID>
        ${scores}
      </PersonCompetency>`;
}

export type EuropassCoverage = {
  percent: number;
  mapped: string[];
  missing: string[];
};

export function analyzeEuropassCoverage(cv: CV): EuropassCoverage {
  const profile = cv.europass || emptyEuropassProfile;
  const checks: Array<[string, boolean]> = [
    ["identité", Boolean(cv.nom_complet)],
    ["titre/profil", Boolean(cv.titre_poste || cv.objectif)],
    ["courriel", Boolean(cv.email)],
    ["téléphone", Boolean(cv.telephone)],
    ["adresse", Boolean(cv.adresse || profile.address_line_1)],
    ["date de naissance", Boolean(isoDate(cv.date_naissance))],
    ["sexe", Boolean(normalizeGender(profile.gender_code))],
    ["nationalité", Boolean(cleanCountryCode(profile.nationality_code))],
    ["lieu de naissance", Boolean(profile.birth_place)],
    ["photo", Boolean(cv.photo?.dataUrl)],
    ["expériences", cv.experiences.length > 0],
    ["études et formations", cv.educations.length + cv.formations.length > 0],
    ["compétences", cv.competences.length > 0],
    ["langues CECRL", profile.languages.some((item) => !item.mother_tongue && Boolean(item.listening))],
    ["certifications", cv.certifications.length > 0],
    ["permis de conduire", Boolean(profile.driving_licences.length || cv.permis_conduire)],
    ["centres d’intérêt", cv.interets.length > 0],
    ["métadonnées employeurs", profile.experience_details.length > 0],
    ["métadonnées études", profile.education_details.length > 0],
  ];
  const mapped = checks.filter(([, present]) => present).map(([label]) => label);
  const missing = checks.filter(([, present]) => !present).map(([label]) => label);
  return { percent: Math.round((mapped.length / checks.length) * 100), mapped, missing };
}

type EuropassXmlPhoto = {
  dataUrl: string;
  mimeType: "image/jpeg" | "image/png";
  filename: string;
};

export function convertCvToEuropassXml(
  cv: CV,
  language: DocumentLanguage = "fr",
  xmlPhoto?: EuropassXmlPhoto,
): string {
  const profile = cv.europass || emptyEuropassProfile;
  const parsedName = parseName(cv.nom_complet);
  const firstName = profile.given_name || parsedName.firstName;
  const lastName = profile.family_name || parsedName.lastName;
  const documentId = deterministicId(`${cv.nom_complet}|${cv.email}|${language}`);
  const birthDate = isoDate(cv.date_naissance);
  const gender = normalizeGender(profile.gender_code);
  const residenceCountry =
    cleanCountryCode(profile.country_code) || countryCodeFromText(profile.country_label || cv.pays || cv.adresse);
  const nationalityCode = cleanCountryCode(profile.nationality_code);
  const birthCountryCode = cleanCountryCode(profile.birth_country_code);
  const city = profile.city || cv.adresse.split(",")[0]?.trim() || cv.wilaya.split(",")[0]?.trim();
  const addressLine1 = profile.address_line_1 || cv.adresse;
  const phone = telephoneParts(cv.telephone, profile.phone_country_code);
  const explicitLanguages = profile.languages || [];
  const inferredMotherTongues: EuropassLanguageProfile[] = explicitLanguages.length
    ? []
    : Object.entries(cv.langues || {})
        .filter(([, level]) => /maternelle|native|أم|母语/i.test(level))
        .map(([code]) => ({
          code: ISO_639_2[code] || code,
          label: code,
          mother_tongue: true,
          listening: "",
          reading: "",
          spoken_interaction: "",
          spoken_production: "",
          writing: "",
        }));
  const languages = [...explicitLanguages, ...inferredMotherTongues];
  const primaryLanguage = languages.find((item) => item.mother_tongue);
  const licences = profile.driving_licences.length
    ? profile.driving_licences
    : Array.from(cv.permis_conduire.matchAll(/(?:cat[eé]gorie|category|classe?)\s*([A-Z][A-Z0-9]*)/gi)).map(
        (match) => match[1].toUpperCase(),
      );
  const photoPrefix = xmlPhoto ? `data:${xmlPhoto.mimeType};base64,` : "";
  const photoBase64 = xmlPhoto?.dataUrl.startsWith(photoPrefix)
    ? xmlPhoto.dataUrl.slice(photoPrefix.length)
    : "";
  const photoAttachmentXml = photoBase64
    ? `<Attachment>
      <oa:EmbeddedData mimeCode="${xmlPhoto?.mimeType}" encodingCode="base64Binary" filename="${escapeXml(xmlPhoto?.filename || "photo-profil.jpg")}">${photoBase64}</oa:EmbeddedData>
      <oa:FileName>${escapeXml(xmlPhoto?.filename || "photo-profil.jpg")}</oa:FileName>
      <oa:Description>Candidate photo</oa:Description>
      <oa:FileType listName="EURES_FileTypeCode" listVersionID="1.0" name="photo" listURI="https://ec.europa.eu/eures">photo</oa:FileType>
      <DocumentTitle>photo</DocumentTitle>
      <AttachmentXPath>/Candidate/CandidatePerson</AttachmentXPath>
    </Attachment>`
    : "";

  const communications = [
    cv.email
      ? `<Communication><ChannelCode>Email</ChannelCode><oa:URI>${escapeXml(cv.email)}</oa:URI></Communication>`
      : "",
    profile.instant_messaging
      ? `<Communication><ChannelCode>InstantMessage</ChannelCode><UseCode>other</UseCode><oa:URI>${escapeXml(
          profile.instant_messaging,
        )}</oa:URI></Communication>`
      : "",
    cv.telephone && phone.dialNumber
      ? `<Communication><ChannelCode>Telephone</ChannelCode><UseCode>mobile</UseCode>${
          phone.countryDialing ? `<CountryDialing>${phone.countryDialing}</CountryDialing>` : ""
        }<oa:DialNumber>${phone.dialNumber}</oa:DialNumber>${
          residenceCountry ? `<CountryCode>${residenceCountry}</CountryCode>` : ""
        }</Communication>`
      : "",
    addressLine1 || city
      ? `<Communication><UseCode>home</UseCode><Address type="home">${
          addressLine1 ? `<oa:AddressLine>${escapeXml(addressLine1)}</oa:AddressLine>` : ""
        }${profile.address_line_2 ? `<oa:AddressLine>${escapeXml(profile.address_line_2)}</oa:AddressLine>` : ""}${
          city ? `<oa:CityName>${escapeXml(city)}</oa:CityName>` : ""
        }${residenceCountry ? `<CountryCode>${residenceCountry}</CountryCode>` : ""}${
          profile.postal_code ? `<oa:PostalCode>${escapeXml(profile.postal_code)}</oa:PostalCode>` : ""
        }</Address></Communication>`
      : "",
    profile.website
      ? `<Communication><ChannelCode>Web</ChannelCode><oa:URI>${escapeXml(profile.website)}</oa:URI></Communication>`
      : "",
    ...profile.social_profiles
      .filter((item) => item.url || item.username)
      .map(
        (item) => `<Communication><ChannelCode>SocialMedia</ChannelCode>${
          item.platform ? `<UseCode>${escapeXml(item.platform.toLowerCase())}</UseCode>` : ""
        }<oa:URI>${escapeXml(item.url || item.username)}</oa:URI></Communication>`,
      ),
  ].filter(Boolean);

  const employmentXml = cv.experiences
    .map((experience) => {
      const details = experienceDetails(cv, experience.id);
      const dates = parseDateRange(experience.dates);
      const countryCode =
        cleanCountryCode(details?.country_code || "") || countryCodeFromText(details?.country_label || experience.lieu);
      const place = details?.city || experience.lieu.split(",")[0]?.trim();
      return `<EmployerHistory>
        <hr:OrganizationName>${escapeXml(experience.employeur)}</hr:OrganizationName>
        ${
          place || countryCode || details?.website
            ? `<OrganizationContact>${
                place || countryCode
                  ? `<Communication><Address>${place ? `<oa:CityName>${escapeXml(place)}</oa:CityName>` : ""}${
                      countryCode ? `<CountryCode>${countryCode}</CountryCode>` : ""
                    }</Address></Communication>`
                  : ""
              }${
                details?.website
                  ? `<Communication><ChannelCode>Web</ChannelCode><oa:URI>${escapeXml(details.website)}</oa:URI></Communication>`
                  : ""
              }</OrganizationContact>`
            : ""
        }
        ${details?.industry_code ? `<hr:IndustryCode>${escapeXml(details.industry_code)}</hr:IndustryCode>` : ""}
        <PositionHistory>
          <PositionTitle typeCode="FREETEXT">${escapeXml(experience.titre)}</PositionTitle>
          <eures:EmploymentPeriod>${
            dates.start
              ? `<eures:StartDate><hr:FormattedDateTime>${dates.start}</hr:FormattedDateTime></eures:StartDate>`
              : ""
          }${
            dates.end
              ? `<eures:EndDate><hr:FormattedDateTime>${dates.end}</hr:FormattedDateTime></eures:EndDate>`
              : ""
          }<hr:CurrentIndicator>${dates.current}</hr:CurrentIndicator></eures:EmploymentPeriod>
          ${
            experience.descriptions.length
              ? `<oa:Description>${escapeXml(richList(experience.descriptions))}</oa:Description>`
              : ""
          }
          ${place ? `<City>${escapeXml(place)}</City>` : ""}${countryCode ? `<Country>${countryCode}</Country>` : ""}
        </PositionHistory>
        ${details?.department ? `<Department>${escapeXml(details.department)}</Department>` : ""}
      </EmployerHistory>`;
    })
    .join("");

  const educationItems: Array<{
    id: string;
    date: string;
    lieu: string;
    titre: string;
    institution: string;
    details: string[];
  }> = [
    ...cv.educations.map((item) => ({
      id: item.id,
      date: item.date,
      lieu: item.lieu,
      titre: item.titre,
      institution: item.institution,
      details: [item.option, item.equivalence].filter(Boolean),
    })),
    ...cv.formations.map((item) => ({
      id: item.id,
      date: item.date,
      lieu: item.lieu,
      titre: item.titre,
      institution: item.institution,
      details: item.competences ? [item.competences] : [],
    })),
  ];
  const educationXml = educationItems
    .map((item) => {
      const details = educationDetails(cv, item.id);
      const dates = parseDateRange(item.date);
      const countryCode =
        cleanCountryCode(details?.country_code || "") || countryCodeFromText(details?.country_label || item.lieu);
      const place = details?.city || item.lieu.split(",")[0]?.trim();
      return `<EducationOrganizationAttendance>
        <hr:OrganizationName>${escapeXml(item.institution)}</hr:OrganizationName>
        ${
          place || countryCode || details?.website
            ? `<OrganizationContact>${
                place || countryCode
                  ? `<Communication><Address>${place ? `<oa:CityName>${escapeXml(place)}</oa:CityName>` : ""}${
                      countryCode ? `<CountryCode>${countryCode}</CountryCode>` : ""
                    }</Address></Communication>`
                  : ""
              }${
                details?.website
                  ? `<Communication><ChannelCode>Web</ChannelCode><oa:URI>${escapeXml(details.website)}</oa:URI></Communication>`
                  : ""
              }</OrganizationContact>`
            : ""
        }
        ${details?.eqf_level ? `<EducationLevelCode>${escapeXml(details.eqf_level)}</EducationLevelCode>` : ""}
        <AttendancePeriod>${
          dates.start ? `<StartDate><hr:FormattedDateTime>${dates.start}</hr:FormattedDateTime></StartDate>` : ""
        }${dates.end ? `<EndDate><hr:FormattedDateTime>${dates.end}</hr:FormattedDateTime></EndDate>` : ""}<Ongoing>${
          dates.current
        }</Ongoing></AttendancePeriod>
        <EducationDegree><hr:DegreeName>${escapeXml(item.titre)}</hr:DegreeName>${
          details?.field_code || details?.specific_field_code
            ? `<FieldOfStudy typeCode="URI">${
                details.field_code
                  ? `<MainFieldOfStudy><ProgramConcentration>${escapeXml(details.field_code)}</ProgramConcentration></MainFieldOfStudy>`
                  : ""
              }${
                details.specific_field_code
                  ? `<SpecificFieldOfStudy><ProgramConcentration>${escapeXml(
                      details.specific_field_code,
                    )}</ProgramConcentration></SpecificFieldOfStudy>`
                  : ""
              }</FieldOfStudy>`
            : ""
        }${
          item.details.length
            ? `<OccupationalSkillsCovered>${escapeXml(richList(item.details))}</OccupationalSkillsCovered>`
            : ""
        }</EducationDegree>
      </EducationOrganizationAttendance>`;
    })
    .join("");

  const languageXml = languages.map(renderLanguage).filter(Boolean).join("");
  const skillsXml = cv.competences
    .map(
      (skill) => `<PersonCompetency><hr:TaxonomyID>Digital_Skill</hr:TaxonomyID><hr:CompetencyName>${escapeXml(
        skill,
      )}</hr:CompetencyName></PersonCompetency>`,
    )
    .join("");
  const certificationsXml = cv.certifications
    .map((item) => `<CourseCertification><Title>${escapeXml(item)}</Title></CourseCertification>`)
    .join("");
  const hobbiesXml = cv.interets
    .map(
      (item) => `<HobbyOrInterest><Title>${escapeXml(item)}</Title><Description>${escapeXml(item)}</Description></HobbyOrInterest>`,
    )
    .join("");
  const projectsXml = cv.participations
    .map((item) => `<Project><Title>${escapeXml(item)}</Title><Description>${escapeXml(item)}</Description></Project>`)
    .join("");
  const sections = [
    cv.experiences.length ? "work-experience" : "",
    educationItems.length ? "education-training" : "",
    languages.length ? "language" : "",
    cv.competences.length ? "profile-skills" : "",
    cv.certifications.length ? "certifications" : "",
    licences.length ? "driving-licence" : "",
    cv.interets.length ? "hobbies-interests" : "",
    cv.participations.length ? "projects" : "",
  ].filter(Boolean);

  return `<?xml version="1.0" encoding="UTF-8"?>
<Candidate xmlns="http://www.europass.eu/1.0"
  xmlns:hr="http://www.hr-xml.org/3"
  xmlns:oa="http://www.openapplications.org/oagis/9"
  xmlns:eures="http://www.europass_eures.eu/1.0"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.europass.eu/1.0 Candidate.xsd">
  <hr:DocumentID schemeID="${documentId}" schemeName="DocumentIdentifier" schemeAgencyName="EUROPASS" schemeVersionID="4.0" />
  <CandidateSupplier>
    <hr:PartyID schemeID="${documentId}" schemeName="PartyID" schemeAgencyName="EUROPASS" schemeVersionID="1.0" />
    <hr:PartyName>Owner</hr:PartyName>
    <PersonContact><PersonName><oa:GivenName>${escapeXml(firstName)}</oa:GivenName><hr:FamilyName>${escapeXml(
      lastName,
    )}</hr:FamilyName></PersonName>${
      cv.email
        ? `<Communication><ChannelCode>Email</ChannelCode><oa:URI>${escapeXml(cv.email)}</oa:URI></Communication>`
        : ""
    }</PersonContact>
    <hr:PrecedenceCode>1</hr:PrecedenceCode>
  </CandidateSupplier>
  <CandidatePerson>
    <PersonName><oa:GivenName>${escapeXml(firstName)}</oa:GivenName><hr:FamilyName>${escapeXml(lastName)}</hr:FamilyName></PersonName>
    ${communications.join("")}
    ${nationalityCode ? `<NationalityCode>${nationalityCode}</NationalityCode>` : ""}
    ${birthDate ? `<hr:BirthDate>${birthDate}</hr:BirthDate>` : ""}
    ${
      profile.birth_place || birthCountryCode
        ? `<BirthPlace>${profile.birth_place ? `<City>${escapeXml(profile.birth_place)}</City>` : ""}${
            birthCountryCode ? `<CountryCode>${birthCountryCode}</CountryCode>` : ""
          }</BirthPlace>`
        : ""
    }
    ${gender ? `<GenderCode>${gender}</GenderCode>` : ""}
    ${
      primaryLanguage
        ? `<PrimaryLanguageCode name="NORMAL">${escapeXml(
            ISO_639_2[primaryLanguage.code] || primaryLanguage.code,
          )}</PrimaryLanguageCode>`
        : ""
    }
  </CandidatePerson>
  <CandidateProfile languageCode="${language}">
    <hr:ID schemeID="${documentId}" schemeName="CandidateProfileID" schemeAgencyName="EUROPASS" schemeVersionID="1.0" />
    ${cv.objectif ? `<hr:ExecutiveSummary>${escapeXml(cv.objectif)}</hr:ExecutiveSummary>` : ""}
    <EmploymentHistory>${employmentXml}</EmploymentHistory>
    <EducationHistory>${educationXml}</EducationHistory>
    <eures:Licenses>${licences
      .map((licence) => `<eures:License><hr:LicenseTypeCode>${escapeXml(licence)}</hr:LicenseTypeCode></eures:License>`)
      .join("")}</eures:Licenses>
    <Certifications />
    <PublicationHistory />
    <PersonQualifications>${languageXml}</PersonQualifications>
    <EmploymentReferences />
    <HobbiesAndInterests>${hobbiesXml}</HobbiesAndInterests>
    <CreativeWorks />
    <Projects>${projectsXml}</Projects>
    <SocialAndPoliticalActivities />
    <Skills>${cv.competences.length ? `<SkillsGroup><Title>${language === "fr" ? "Compétences" : "Skills"}</Title>${skillsXml}</SkillsGroup>` : ""}</Skills>
    <NetworksAndMemberships />
    <ConferencesAndSeminars />
    <VoluntaryWorks />
    <CourseCertifications>${certificationsXml}</CourseCertifications>
    ${photoAttachmentXml}
  </CandidateProfile>
  <RenderingInformation><Design><Template>Template3</Template><Color>Default</Color><FontSize>Medium</FontSize><Logo>FirstPage</Logo><PageNumbers>false</PageNumbers><SectionsOrder>${sections
    .map((section) => `<Section><Title>${section}</Title></Section>`)
    .join("")}</SectionsOrder></Design></RenderingInformation>
</Candidate>`;
}

async function europassXmlPhoto(cv: CV): Promise<EuropassXmlPhoto | undefined> {
  if (!cv.photo?.dataUrl) return undefined;
  return {
    dataUrl: await profilePhotoDataUrlForPdf(cv.photo),
    mimeType: "image/jpeg",
    filename: "photo-profil.jpg",
  };
}

export async function downloadEuropassXml(cv: CV, language: DocumentLanguage = "fr") {
  const xmlContent = convertCvToEuropassXml(cv, language, await europassXmlPhoto(cv));
  const blob = new Blob([xmlContent], { type: "application/xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  const cleanName = (cv.nom_complet || "CV").replace(/[^a-zA-Z0-9_-]/g, "_");
  a.href = url;
  a.download = `Europass-CV-${cleanName}-${language.toUpperCase()}.xml`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function downloadEuropassMultilingualZip(
  documents: Partial<Record<DocumentLanguage, CV>>,
  baseCv: CV,
) {
  const files: Record<string, Uint8Array> = {};
  const languages: DocumentLanguage[] = ["fr", "en", "es", "de", "it", "zh", "ar"];

  for (const lang of languages) {
    const cvDoc = documents[lang] || baseCv;
    const xml = convertCvToEuropassXml(cvDoc, lang, await europassXmlPhoto(cvDoc));
    const cleanName = (cvDoc.nom_complet || "CV").replace(/[^a-zA-Z0-9_-]/g, "_");
    files[`Europass-CV-${cleanName}-${lang.toUpperCase()}.xml`] = strToU8(xml);
  }

  const zipBuffer = zipSync(files, { level: 6 });
  const zipBytes = new Uint8Array(zipBuffer.byteLength);
  zipBytes.set(zipBuffer);
  const blob = new Blob([zipBytes.buffer], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const cleanName = (baseCv.nom_complet || "CV").replace(/[^a-zA-Z0-9_-]/g, "_");

  a.href = url;
  a.download = `Europass-Pack-7-Langues-${cleanName}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function parseCandidateEuropassXml(doc: Document): CV {
  const one = (name: string, context: Element | Document = doc): Element | null =>
    context.getElementsByTagNameNS("*", name)[0] || null;
  const all = (name: string, context: Element | Document = doc): Element[] =>
    Array.from(context.getElementsByTagNameNS("*", name));
  const value = (name: string, context: Element | Document = doc): string =>
    (one(name, context)?.textContent || "").trim();
  const direct = (name: string, context: Element): Element | null =>
    Array.from(context.children).find((element) => element.localName === name) || null;
  const directValue = (name: string, context: Element): string =>
    (direct(name, context)?.textContent || "").trim();
  const htmlItems = (source: string): string[] => {
    if (!source) return [];
    const parsed = new DOMParser().parseFromString(source, "text/html");
    const listItems = Array.from(parsed.querySelectorAll("li"))
      .map((item) => (item.textContent || "").trim())
      .filter(Boolean);
    if (listItems.length) return listItems;
    const plain = (parsed.body.textContent || source).trim();
    return plain ? plain.split(/\n|•|\*/).map((item) => item.trim()).filter(Boolean) : [];
  };
  const formattedPeriod = (context: Element): string => {
    const startNode = one("StartDate", context);
    const endNode = one("EndDate", context);
    const start = startNode ? value("FormattedDateTime", startNode) : "";
    const end = endNode ? value("FormattedDateTime", endNode) : "";
    const current = value("CurrentIndicator", context) === "true" || value("Ongoing", context) === "true";
    return [start, current ? "Présent" : end].filter(Boolean).join(" – ");
  };

  const person = one("CandidatePerson");
  const profileNode = one("CandidateProfile");
  if (!person || !profileNode) throw new Error("Document Europass Candidate incomplet.");

  const givenName = value("GivenName", person);
  const familyName = value("FamilyName", person);
  const communications = all("Communication", person);
  const communicationByCode = (code: string) =>
    communications.find((item) => directValue("ChannelCode", item) === code);
  const emailNode = communicationByCode("Email");
  const phoneNode = communicationByCode("Telephone");
  const instantNode = communicationByCode("InstantMessage");
  const webNode = communicationByCode("Web");
  const addressCommunication = communications.find((item) => direct("Address", item));
  const addressNode = addressCommunication ? direct("Address", addressCommunication) : null;
  const email = emailNode ? value("URI", emailNode) : "";
  const dialing = phoneNode ? value("CountryDialing", phoneNode) : "";
  const dialNumber = phoneNode ? value("DialNumber", phoneNode) : "";
  const phone = dialNumber ? `${dialing ? `+${dialing} ` : ""}${dialNumber}` : "";
  const addressLines = addressNode ? all("AddressLine", addressNode).map((item) => (item.textContent || "").trim()) : [];
  const city = addressNode ? value("CityName", addressNode) : "";
  const countryCode = addressNode ? value("CountryCode", addressNode).toLowerCase() : "";
  const postalCode = addressNode ? value("PostalCode", addressNode) : "";

  const experienceNodes = all("EmployerHistory", profileNode);
  const experienceDetailsList: EuropassExperienceDetails[] = [];
  const experiences: Experience[] = experienceNodes.map((node) => {
    const id = newId();
    const position = one("PositionHistory", node) || node;
    const organizationContact = one("OrganizationContact", node);
    const place = organizationContact ? value("CityName", organizationContact) : value("City", position);
    const itemCountry = value("Country", position) || (organizationContact ? value("CountryCode", organizationContact) : "");
    const websiteCommunication = all("Communication", node).find(
      (item) => directValue("ChannelCode", item) === "Web",
    );
    experienceDetailsList.push({
      id,
      city: place,
      country_code: itemCountry.toLowerCase(),
      country_label: "",
      industry_code: value("IndustryCode", node),
      department: value("Department", node),
      website: websiteCommunication ? value("URI", websiteCommunication) : "",
    });
    return {
      id,
      dates: formattedPeriod(position),
      lieu: [place, itemCountry.toUpperCase()].filter(Boolean).join(", "),
      titre: value("PositionTitle", position),
      employeur: value("OrganizationName", node),
      descriptions: htmlItems(value("Description", position)),
    };
  });

  const educationDetailsList: EuropassEducationDetails[] = [];
  const educations: Education[] = [];
  const formations: Formation[] = [];
  all("EducationOrganizationAttendance", profileNode).forEach((node) => {
    const title = value("DegreeName", node);
    const institution = value("OrganizationName", node);
    const place = value("CityName", node);
    const itemCountry = value("CountryCode", node).toLowerCase();
    const detailsText = htmlItems(value("OccupationalSkillsCovered", node));
    const period = formattedPeriod(node);
    const level = value("EducationLevelCode", node);
    const fieldCodes = all("ProgramConcentration", node).map((item) => (item.textContent || "").trim());
    const websiteCommunication = all("Communication", node).find(
      (item) => directValue("ChannelCode", item) === "Web",
    );
    const degreeLike = Boolean(level) || /master|licen[cs]e|bachelor|degree|dipl[oô]me|bac|universit/i.test(title);
    const id = newId();
    educationDetailsList.push({
      id,
      city: place,
      country_code: itemCountry,
      country_label: "",
      eqf_level: level,
      field_code: fieldCodes[0] || "",
      specific_field_code: fieldCodes[1] || "",
      website: websiteCommunication ? value("URI", websiteCommunication) : "",
    });
    if (degreeLike) {
      educations.push({
        id,
        date: period,
        lieu: [place, itemCountry.toUpperCase()].filter(Boolean).join(", "),
        titre: title,
        institution,
        option: detailsText[0] || "",
        equivalence: detailsText.slice(1).join(" · "),
      });
    } else {
      formations.push({
        id,
        date: period,
        lieu: [place, itemCountry.toUpperCase()].filter(Boolean).join(", "),
        titre: title,
        institution,
        competences: detailsText.join(" · "),
      });
    }
  });

  const languageLabels: Record<string, string> = {
    ara: "Arabe",
    fre: "Français",
    eng: "Anglais",
    ger: "Allemand",
    spa: "Espagnol",
    ita: "Italien",
    chi: "Chinois",
    kab: "Kabyle",
  };
  const primaryLanguage = value("PrimaryLanguageCode", person).toLowerCase();
  const languageProfiles: EuropassLanguageProfile[] = [];
  if (primaryLanguage) {
    languageProfiles.push({
      code: primaryLanguage,
      label: languageLabels[primaryLanguage] || primaryLanguage,
      mother_tongue: true,
      listening: "",
      reading: "",
      spoken_interaction: "",
      spoken_production: "",
      writing: "",
    });
  }
  all("PersonCompetency", one("PersonQualifications", profileNode) || profileNode).forEach((node) => {
    if (value("TaxonomyID", node) !== "language") return;
    const code = value("CompetencyID", node).toLowerCase();
    const scores = new Map(
      all("CompetencyDimension", node).map((dimension) => [
        value("CompetencyDimensionTypeCode", dimension),
        value("ScoreText", dimension),
      ]),
    );
    languageProfiles.push({
      code,
      label: languageLabels[code] || code,
      mother_tongue: false,
      listening: parseCefrLevel(scores.get("CEF-Understanding-Listening") || ""),
      reading: parseCefrLevel(scores.get("CEF-Understanding-Reading") || ""),
      spoken_interaction: parseCefrLevel(scores.get("CEF-Speaking-Interaction") || ""),
      spoken_production: parseCefrLevel(scores.get("CEF-Speaking-Production") || ""),
      writing: parseCefrLevel(scores.get("CEF-Writing-Production") || ""),
    });
  });

  const skillsNode = one("Skills", profileNode);
  const competencies = skillsNode
    ? all("CompetencyName", skillsNode).map((item) => (item.textContent || "").trim()).filter(Boolean)
    : [];
  const certifications = all("CourseCertification", profileNode)
    .map((item) => value("Title", item))
    .filter(Boolean);
  const interests = all("HobbyOrInterest", profileNode)
    .map((item) => value("Title", item) || value("Description", item))
    .filter(Boolean);
  const participations = all("Project", profileNode)
    .map((item) => value("Title", item) || value("Description", item))
    .filter(Boolean);
  const drivingLicences = all("LicenseTypeCode", profileNode)
    .map((item) => (item.textContent || "").trim())
    .filter(Boolean);
  const socialProfiles = communications
    .filter((item) => directValue("ChannelCode", item) === "SocialMedia")
    .map((item) => ({
      platform: directValue("UseCode", item),
      username: "",
      url: value("URI", item),
    }));
  const europass: EuropassProfile = {
    ...emptyEuropassProfile,
    given_name: givenName,
    family_name: familyName,
    gender_code: value("GenderCode", person),
    nationality_code: value("NationalityCode", person).toLowerCase(),
    birth_place: value("City", one("BirthPlace", person) || person),
    birth_country_code: value("CountryCode", one("BirthPlace", person) || person).toLowerCase(),
    address_line_1: addressLines[0] || "",
    address_line_2: addressLines[1] || "",
    postal_code: postalCode,
    city,
    country_code: countryCode,
    phone_country_code: dialing,
    website: webNode ? value("URI", webNode) : "",
    instant_messaging: instantNode ? value("URI", instantNode) : "",
    driving_licences: drivingLicences,
    social_profiles: socialProfiles,
    languages: languageProfiles,
    experience_details: experienceDetailsList,
    education_details: educationDetailsList,
  };

  const languageValue = (code: string) => {
    const item = languageProfiles.find((entry) => entry.code === code);
    if (!item) return "";
    if (item.mother_tongue) return "Langue maternelle";
    return item.listening || item.reading || item.writing || "";
  };

  return {
    ...emptyCV,
    nom_complet: [givenName, familyName].filter(Boolean).join(" "),
    telephone: phone,
    email,
    adresse: addressLines.join(", "),
    date_naissance: value("BirthDate", person),
    wilaya: city,
    pays: countryCode.toUpperCase(),
    objectif: value("ExecutiveSummary", profileNode),
    competences: competencies,
    experiences,
    educations,
    formations,
    participations,
    certifications,
    interets: interests,
    permis_conduire: drivingLicences.join(", "),
    langues: {
      fr: languageValue("fre"),
      en: languageValue("eng"),
      ar: languageValue("ara"),
      de: languageValue("ger"),
      es: languageValue("spa"),
      kab: languageValue("kab"),
    },
    europass,
  };
}

async function importedEuropassPhoto(doc: Document) {
  const elements = (name: string, context: Element | Document = doc) =>
    Array.from(context.getElementsByTagNameNS("*", name));
  const text = (name: string, context: Element) =>
    (elements(name, context)[0]?.textContent || "").trim();

  let mimeType = "";
  let base64 = "";
  let filename = "photo-profil";
  const attachment = elements("Attachment").find(
    (item) => text("FileType", item).toLowerCase() === "photo",
  );
  if (attachment) {
    const embedded = elements("EmbeddedData", attachment)[0];
    mimeType = embedded?.getAttribute("mimeCode") || "";
    base64 = (embedded?.textContent || "").replace(/\s+/g, "");
    filename = text("FileName", attachment) || filename;
  } else {
    const photo = elements("Photo")[0];
    if (photo) {
      mimeType = text("MimeType", photo);
      base64 = text("Data", photo).replace(/\s+/g, "");
    }
  }

  if (!base64 || !["image/jpeg", "image/pjpeg", "image/png", "image/x-png", "image/webp"].includes(mimeType)) {
    return undefined;
  }
  if (base64.length > 28_000_000 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) return undefined;

  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    const normalizedMime = mimeType.includes("png") ? "image/png" : mimeType === "image/webp" ? "image/webp" : "image/jpeg";
    const extension = normalizedMime === "image/png" ? ".png" : normalizedMime === "image/webp" ? ".webp" : ".jpg";
    const source = new File([bytes], filename.includes(".") ? filename : `${filename}${extension}`, {
      type: normalizedMime,
    });
    return await processProfilePhoto(source);
  } catch {
    return undefined;
  }
}

export async function parseEuropassXml(xmlString: string): Promise<CV> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("Le fichier XML est invalide.");
  if (doc.documentElement.localName === "Candidate") {
    const cv = parseCandidateEuropassXml(doc);
    return { ...cv, photo: await importedEuropassPhoto(doc) };
  }

  const getText = (selector: string, context: Element | Document = doc): string => {
    const el = context.querySelector(selector);
    return el ? (el.textContent || "").trim() : "";
  };

  const getAllTexts = (selector: string, context: Element | Document = doc): string[] => {
    return Array.from(context.querySelectorAll(selector))
      .map((el) => (el.textContent || "").trim())
      .filter(Boolean);
  };

  const firstName = getText("LearnerInfo > Identification > PersonName > FirstName");
  const lastName = getText("LearnerInfo > Identification > PersonName > Surname");
  const fullName = [lastName, firstName].filter(Boolean).join(" ") || getText("PersonName");

  const email = getText("ContactInfo > Email > Contact");
  const phone = getText("ContactInfo > TelephoneList > Telephone > Contact") || getText("Telephone > Contact");
  const address = getText("ContactAddress > AddressLine") || getText("ContactAddress > Municipality");
  const city = getText("ContactAddress > Municipality");
  const country = getText("ContactAddress > Country > Label") || getText("ContactAddress > Country > Code");

  const birthDateEl = doc.querySelector("Demographics > Birthdate");
  let birthDate = "";
  if (birthDateEl) {
    const y = birthDateEl.getAttribute("year") || getText("Year", birthDateEl);
    const m = birthDateEl.getAttribute("month") || getText("Month", birthDateEl);
    const d = birthDateEl.getAttribute("day") || getText("Day", birthDateEl);
    birthDate = [d, m, y].filter(Boolean).join("/");
  }

  const jobTitle = getText("Headline > Description > Label") || getText("Headline > Type > Label");

  const experienceNodes = Array.from(doc.querySelectorAll("WorkExperienceList > WorkExperience"));
  const experiences: Experience[] = experienceNodes.map((node) => {
    const fromEl = node.querySelector("Period > From");
    const toEl = node.querySelector("Period > To");
    const isCurr = node.querySelector("Period > Current")?.textContent === "true";

    const getFormattedDate = (el: Element | null): string => {
      if (!el) return "";
      const y = el.getAttribute("year") || getText("Year", el) || el.textContent;
      const m = el.getAttribute("month") || getText("Month", el);
      return [m, y].filter(Boolean).join("/");
    };

    const from = getFormattedDate(fromEl);
    const to = isCurr ? "Présent" : getFormattedDate(toEl);
    const dateStr = [from, to].filter(Boolean).join(" – ");
    const title = getText("Position > Label", node) || getText("Position", node);
    const employer = getText("Employer > OrganisationName", node);
    const place = getText("Employer > ContactInfo > Address > ContactAddress > Municipality", node);
    const activitiesText = getText("Activities", node);
    const descriptions = activitiesText
      ? activitiesText.split(/\n|•|\*/).map((s) => s.trim()).filter(Boolean)
      : [];

    return {
      id: newId(),
      dates: dateStr,
      lieu: place,
      titre: title,
      employeur: employer,
      descriptions,
    };
  });

  const educationNodes = Array.from(doc.querySelectorAll("EducationList > Education"));
  const educations: Education[] = [];
  const formations: Formation[] = [];

  educationNodes.forEach((node) => {
    const fromEl = node.querySelector("Period > From");
    const toEl = node.querySelector("Period > To");
    const yFrom = fromEl?.getAttribute("year") || getText("Year", fromEl || node) || fromEl?.textContent || "";
    const yTo = toEl?.getAttribute("year") || getText("Year", toEl || node) || toEl?.textContent || "";
    const dateStr = [yFrom, yTo].filter(Boolean).join(" – ");

    const title = getText("Title", node);
    const org = getText("Organisation > OrganisationName", node);
    const place = getText("Organisation > ContactInfo > Address > ContactAddress > Municipality", node);
    const level = getText("Level > Code", node);

    if (level && /^[4-8]$|^EQF|CEC/i.test(level)) {
      educations.push({
        id: newId(),
        date: dateStr,
        lieu: place,
        titre: org || title,
        institution: title || org,
        option: "",
        equivalence: "",
      });
    } else {
      formations.push({
        id: newId(),
        date: dateStr,
        lieu: place,
        titre: place || dateStr,
        institution: title,
        competences: org,
      });
    }
  });

  const commSkills = getText("Skills > Communication > Description");
  const orgSkills = getText("Skills > Organisational > Description");
  const compSkills = getText("Skills > Computer > Description");
  const allSkills = [commSkills, orgSkills, compSkills]
    .filter(Boolean)
    .flatMap((s) => s.split(/\n|•|\*/).map((item) => item.trim()).filter(Boolean));

  const motherTongues = getAllTexts("Skills > Linguistic > MotherTongueList > MotherTongue > Description > Label");
  const foreignLangs = Array.from(doc.querySelectorAll("Skills > Linguistic > ForeignLanguageList > ForeignLanguage")).map((n) => {
    const name = getText("Description > Label", n) || getText("Description > Code", n);
    const level = getText("ProficiencyLevel > Listening", n) || "Niveau avancé";
    return { name, level };
  });

  const achievements = Array.from(doc.querySelectorAll("AchievementList > Achievement")).map((n) => {
    const title = getText("Title > Label", n);
    const desc = getText("Description", n);
    return `${title ? title + " : " : ""}${desc}`;
  });

  const importedPhoto = await importedEuropassPhoto(doc);
  return {
    ...emptyCV,
    photo: importedPhoto,
    nom_complet: fullName,
    titre_poste: jobTitle,
    email,
    telephone: phone,
    adresse: address,
    wilaya: city,
    pays: country,
    date_naissance: birthDate,
    objectif: commSkills || "",
    competences: allSkills.length ? allSkills : [],
    experiences: experiences.length ? experiences : [],
    educations: educations.length ? educations : [],
    formations: formations.length ? formations : [],
    participations: achievements.filter((a) => !/référence|reference/i.test(a)),
    references: achievements.filter((a) => /référence|reference/i.test(a)),
    langues: {
      fr: foreignLangs.find((l) => /fr/i.test(l.name))?.level || "Niveau avancé",
      en: foreignLangs.find((l) => /anglais|en/i.test(l.name))?.level || "Niveau avancé",
      ar: motherTongues.some((m) => /arabe|ar/i.test(m)) ? "Langue maternelle" : "",
      de: foreignLangs.find((l) => /allemand|de/i.test(l.name))?.level || "",
      es: foreignLangs.find((l) => /espagnol|es/i.test(l.name))?.level || "",
      kab: motherTongues.some((m) => /kabyle|kab/i.test(m)) ? "Langue maternelle" : "",
    },
  };
}
