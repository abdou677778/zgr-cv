import assert from "node:assert/strict";
import test from "node:test";

import {
  parseJobBankDetailHtml,
  parseJobBankHowToApplyHtml,
  parseJobBankSearchHtml,
} from "./canada-opportunities.js";

test("la recherche Guichet-Emplois extrait les cartes récentes sans conserver la session", () => {
  const jobs = parseJobBankSearchHtml(`
    <article id="article-50411434" class="action-buttons">
      <a href="/jobsearch/jobposting/50411434;jsessionid=secret?source=searchresults" class="resultJobItem">
        <h3><span class="flag"><span class="telework">Hybrid</span><span class="appmethod">Direct Apply</span></span>
        <span class="noctitle"> senior accountant </span></h3>
        <ul><li class="date">October 02, 2026</li><li class="business">Wizi Finance</li>
        <li class="location"><span>Location</span> Montréal (QC)</li>
        <li class="salary">Salary $40.00 hourly</li></ul>
      </a>
    </article>
  `);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].id, "50411434");
  assert.equal(jobs[0].title, "senior accountant");
  assert.equal(jobs[0].employer, "Wizi Finance");
  assert.equal(jobs[0].directApplyAdvertised, true);
  assert.match(jobs[0].sourceUrl, /50411434/);
  assert.doesNotMatch(jobs[0].sourceUrl, /jsessionid/i);
  assert.match(jobs[0].requestUrl, /jsessionid=secret/i);
});

test("la fiche confirme les candidats internationaux, l'échéance et le site employeur", () => {
  const job = parseJobBankDetailHtml(
    `
      <div typeof="JobPosting">
        <h1><span property="title">software developer</span></h1>
        <span property="datePosted">Posted on October 02, 2026</span>
        <span property="hiringOrganization"><span property="name">Wizi Tech</span></span>
        <span property="description">Build accessible web products.</span>
        <span property="addressLocality">Ottawa</span><span property="addressRegion">ON</span>
        <span property="employmentType">Permanent employment</span>
        <div class="job-audience"><p>The employer accepts applications from:</p><ul>
          <li>other candidates, with or without a valid Canadian work permit</li>
        </ul></div>
        <div class="external-job"><a href="https://jobs.example.com/apply/42">Learn more</a></div>
        <p property="validThrough">2026-10-31</p>
      </div>
    `,
    {
      id: "50411434",
      sourceUrl: "https://www.jobbank.gc.ca/jobsearch/jobposting/50411434",
      salary: "$40.00 hourly",
      lmiaStatus: "requested",
    },
  );
  assert.equal(job.acceptsInternational, true);
  assert.equal(job.deadlineAt, "2026-10-31T00:00:00.000Z");
  assert.equal(job.applicationMethod.type, "company_site");
  assert.equal(job.applicationMethod.loginRequired, false);
  assert.equal(job.applicationMethod.url, "https://jobs.example.com/apply/42");
});

test("une échéance absente reste absente et la candidature directe annonce la connexion", () => {
  const job = parseJobBankDetailHtml(
    `
      <span property="title">cook</span>
      <div class="job-audience">other candidates, with or without a valid Canadian work permit</div>
      <a id="btn-direct-apply" href="#direct-apply-popup">Direct Apply</a>
    `,
    { id: "42", sourceUrl: "https://www.jobbank.gc.ca/jobsearch/jobposting/42" },
  );
  assert.equal(job.deadlineAt, null);
  assert.equal(job.applicationMethod.type, "job_bank_direct");
  assert.equal(job.applicationMethod.loginRequired, true);
});

test("les instructions dynamiques exposent directement l'e-mail officiel", () => {
  const contact = parseJobBankHowToApplyHtml(`
    <partial-response><changes><update id="applynow"><![CDATA[
      <section id="howtoapply" class="how-to-apply">
        <h2>How to apply</h2><h3>By email</h3>
        <p><a href="mailto:jobs@example.ca?subject=Application">jobs@example.ca</a></p>
        <p>Include a cover letter and the job reference number.</p>
      </section>
    ]]></update></changes></partial-response>
  `);
  assert.equal(contact.type, "email");
  assert.equal(contact.email, "jobs@example.ca");
  assert.equal(contact.url, "mailto:jobs@example.ca");
  assert.equal(contact.loginRequired, false);
  assert.match(contact.details, /cover letter/i);
  assert.equal(contact.extracted, true);
  assert.equal(contact.options.length, 1);
});

test("les instructions dynamiques détectent un formulaire externe", () => {
  const contact = parseJobBankHowToApplyHtml(`
    <section id="howtoapply"><h3>Online</h3>
      <a href="https://careers.example.ca/apply/50411434">Apply online</a>
    </section>
  `);
  assert.equal(contact.type, "external_form");
  assert.equal(contact.url, "https://careers.example.ca/apply/50411434");
  assert.equal(contact.loginRequired, false);
});

test("un bloc Direct Apply imbriqué conserve l'e-mail alternatif obligatoire", () => {
  const contact = parseJobBankHowToApplyHtml(
    `
      <partial-response><changes><update id="applynow"><![CDATA[
        <div id="applynow"><div id="howtoapply"><h3>How to apply</h3>
          <h4>By Direct Apply <a href="#help">Help</a></h4>
          <section><div><p>You need a Plus account.</p></div></section>
          <details><summary>Additional ways to apply</summary>
            <h4>By email</h4><p><a href="mailto:recruitment@example.ca">recruitment@example.ca</a></p>
          </details>
        </div></div>
      ]]></update></changes></partial-response>
    `,
    {
      type: "job_bank_direct",
      url: "https://www.jobbank.gc.ca/jobsearch/jobposting/50414483",
      label: "Candidature directe Guichet-Emplois",
      loginRequired: true,
    },
  );
  assert.equal(contact.type, "email");
  assert.equal(contact.email, "recruitment@example.ca");
  assert.deepEqual(
    contact.options.map((option) => option.type),
    ["email", "job_bank_direct"],
  );
  assert.equal(contact.options[1].loginRequired, true);
});

test("les méthodes courrier, en personne et téléphone restent distinctes", () => {
  const contact = parseJobBankHowToApplyHtml(
    `
      <div id="howtoapply">
        <h4>By mail</h4><p>100 Main Street<br>Ottawa, ON K1A 0A6</p>
        <h4>In person</h4><p>100 Main Street<br>Between 09:00 and 16:00</p>
        <h4>By telephone</h4><p><a href="tel:+16135550123">613-555-0123</a></p>
      </div>
    `,
    { url: "https://www.jobbank.gc.ca/jobsearch/jobposting/42" },
  );
  assert.equal(contact.type, "phone");
  assert.equal(contact.phone, "+16135550123");
  assert.deepEqual(
    contact.options.map((option) => option.type),
    ["phone", "mail", "in_person", "public_instructions"],
  );
  assert.match(contact.options.find((option) => option.type === "mail").details, /100 Main Street/);
});

test("une adresse e-mail mal encodée ne bloque pas le rafraîchissement", () => {
  const contact = parseJobBankHowToApplyHtml(
    `<div id="howtoapply"><h4>By email</h4><a href="mailto:%E0%A4%A">invalid</a></div>`,
    {
      type: "public_instructions",
      url: "https://www.jobbank.gc.ca/jobsearch/jobposting/42",
      label: "Consignes officielles",
    },
  );
  assert.equal(contact.type, "public_instructions");
  assert.equal(contact.email, "");
  assert.equal(contact.extracted, false);
});

test("la fiche française confirme strictement l'admissibilité internationale", () => {
  const job = parseJobBankDetailHtml(
    `<span property="title">cuisinier</span>
     <div class="job-audience">autres candidates, avec ou sans permis de travail canadien valide</div>`,
    { id: "77", sourceUrl: "https://www.jobbank.gc.ca/jobsearch/jobposting/77" },
  );
  assert.equal(job.acceptsInternational, true);
});
