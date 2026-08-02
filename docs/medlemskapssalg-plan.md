# Plan: Medlemskapssystem for Ekko/Østre (fase 1 av eget salgssystem)

**Mål:** Selge og administrere medlemskap i egen regi — kjøp på nett med
Vipps/kort, register med sesongbasert gyldighet, dørsalg og fornyelse — bygget
som et gjenbrukbart commerce-fundament slik at billettsalg (fase 2) kan bygges
oppå og TicketCo på sikt fases ut.

**Kilder:**
- [frontend #7](https://github.com/Kulturhuset-Ostre-AS/ostre-ekko-web-frontend/issues/7)
  (kravliste fra Olav, april 2026)
- Google-doc **«Oppsett nettside medlemskap»** (Olav, 2026-04-08) — sidetekst,
  skjemafelter, priser og sesongmodell. **Der docen og #7 spriker, legges docen
  til grunn (nyest); avvik er listet under Avklaringer.**

---

## 1. Produktregler (fra Google-docen)

- **To typer:** Ordinært **300 kr/halvår**, student **200 kr/halvår**.
- **Sesongbasert gyldighet** (ikke rullerende 12 mnd som #7 sa):
  - Vårsesong: gyldig til 30. juni. Selges fra 1. desember.
  - Høstsesong: gyldig til 31. desember. Selges fra 1. mai.
  - Kjøp i salgsvinduet før sesongstart gjelder fra kjøpsdato (desember-kjøp
    gir «gratis» desember — enkelt og kundevennlig).
- **Fordeler** (informasjon på siden, håndheves manuelt i dør/bar i fase 1):
  inntil 100 kr rabatt på billetter, rabatt på Ekkofestivalen, tilbud i baren,
  invitasjon til medlemsmøter.
- **Fysisk medlemsbevis** hentes på Østre ved neste besøk. E-posten er
  kjøpsbekreftelse med medlems-ID — ikke PDF/QR-bevis. (QR utsettes til fase
  2, der den trengs for billettskanning.)
- **Fornyelse:** samme e-post → samme medlem; nytt kjøp = ny sesong.
  Studentstatus sjekkes manuelt ved henting av kort (studentbevis i dør).

## 2. Arkitektur — alt i eksisterende stack

| Behov | Løsning |
|---|---|
| Register + admin-UI (søk/filter/status) | Payload-collections + admin-panelet |
| Kjøpsside `/medlemskap` | Ny route i React-Router-frontenden (CF Pages), innhold fra Payload |
| Checkout + webhooks | Payload custom endpoints på Cloud Run (Postgres-transaksjoner, offentlig HTTPS) |
| Betaling | **Vipps MobilePay Checkout** (hosted side: Vipps + kort i én avtale, ingen kortdata hos oss) |
| E-post | **Resend** via `@payloadcms/email-resend` (GDPR: DPF-sertifisert + DPA — ok for disse dataene) |
| Dørsalg | Manuell registrering i Payload-admin (iPad/mobil) |
| Secrets/infra | Eksisterende terraform-payload + Secret Manager-mønster |

Nytt utenfor stacken: Vipps MobilePay-bedriftsavtale (KYC, **kritisk sti —
søk først**) og Resend-konto med DKIM/SPF i Cloudflare DNS.

**E-POST I DRIFT 2026-08-02:** Resend-konto opprettet, domenet `send.ekko.no`
verifisert (EU-region; apex-SPF-en urørt — return-path ligger på
`send.send.ekko.no`, DMARC-alignment via DKIM). `RESEND_API_KEY`/`EMAIL_FROM`
via terraform. Verifisert: medlemskvittering levert (Resend-logg: delivered)
og passord-reset for redaktører fungerer.

**Forutsetninger (gjøres FØR dette prosjektet, sammen med cutover):**
1. Payload-cutover fullført (commerce bygges ikke mot Craft).
2. **E-postadapter konfigurert** — trengs uansett til passord-reset for
   redaktørene (uten adapter logges e-poster bare til konsollen, sendes ikke).
3. **Roller i Users-collection** — i dag kan alle brukere alt; det må skilles
   admin/redaktør før medlemsdata (GDPR) legges inn. Avklar hvem som skal se
   registeret.

## 3. Datamodell

Generisk (ordre ≠ medlemskap) slik at fase 2 gjenbruker alt.

### `orders` (collection — låst for offentlig lesing)
- `type`: `membership` (fase 2: `ticket`)
- `status`: `pending` → `paid` | `failed` | `refunded` (statusmaskin, kun
  gyldige overganger)
- `amount` (øre), `currency` (`NOK`)
- `provider`: `vipps` | `door`; `providerRef` (Vipps-referanse, unik indeks —
  idempotensnøkkel for webhooks); `rawEvents` (JSON-logg av webhook-payloads)
- Kjøperfelter (snapshot ved kjøp): navn, e-post, adresse, postnr, poststed,
  fødselsår
- `membershipType`: `ordinary` | `student`; `season` (f.eks. `2027-var`)
- `consentNewsletter` (bool — Mailchimp er nice-to-have, feltet koster ingenting)

### `members` (collection — låst for offentlig lesing)
- `memberId`: autogenerert, sekvensiell per år (`EKKO-2027-0042`)
- `email` (unik indeks — fornyelsesnøkkel), navn, adresse, postnr, poststed,
  fødselsår
- `membershipType` (siste kjøpte), `validUntil` (dato = sesongslutt),
  `cardPickedUp` (bool — settes i dør når fysisk bevis hentes)
- `source`: `web` | `door`
- `orders`: relasjon (kjøpshistorikk = fornyelseshistorikk, dekker #7s
  «historikk bør beholdes»)
- **Status aktiv/utløpt beregnes** fra `validUntil` (virtuelt felt + list-
  filter i admin). Ingen cron.

### `membership-config` (global)
- Typer med pris (ordinær/student), sesongdefinisjoner og salgsvinduer
  (fra-dato per sesong), sidetekst (rich text — ferdig i Google-docen),
  på/av-bryter for salg.

## 4. Kjøpsflyt (web)

1. **`/medlemskap`** (nb + en): loader henter `membership-config`. Viser
   tekst/fordeler (struktur = Google-docen) + skjema: navn, e-post, adresse,
   postnr, poststed, fødselsår, valg ordinær/student. Utenfor salgsvindu:
   informasjon om når neste salg åpner i stedet for skjema.
2. **`POST /api/commerce/membership/checkout`** (Payload endpoint):
   - Validerer felter + at salgsvinduet er åpent + pris slås opp server-side
     (aldri fra klienten).
   - Oppretter `pending`-ordre, oppretter Vipps Checkout-sesjon (API-nøkler
     fra Secret Manager), returnerer redirect-URL.
3. Bruker betaler på Vipps-hostet side (Vipps eller kort).
4. **`POST /api/commerce/vipps/webhook`**: autentisert (Vipps signatur),
   **idempotent** på `providerRef`, i én Postgres-transaksjon:
   - ordre → `paid`
   - **upsert medlem på e-post**: ny → opprett (`validUntil` = sesongslutt);
     eksisterende → oppdater type + `validUntil`, koble ordren til historikken
   - send bekreftelses-e-post (Resend): kvittering + medlems-ID + «hent
     medlemsbevis på Østre ved neste besøk»
5. **`/medlemskap/takk`**: poller ordrestatus via
   `GET /api/commerce/orders/:id/status` (offentlig,返回 kun status — fallback
   når webhook er treg; Vipps re-leverer feilede webhooks).

**Kanter som skal håndteres:** dobbel webhook-leveranse (idempotens), avbrutt
betaling (ordre forblir `pending`, ryddes av og til), webhook før redirect
(takk-siden poller), to samtidige kjøp på samme e-post (unik indeks +
transaksjon → siste vinner, begge ordrer bevares), refusjon (manuelt i
Vipps-portalen + statusendring i admin i fase 1).

## 5. Dørsalg og admin

- **Dørsalg:** betjening (redaktørrolle) oppretter medlem i Payload-admin på
  iPad — samme felter, `source: door`, `provider: door`-ordre med beløp
  (betalt via kortterminal/kontant). Registeret er komplett fra M1, før
  nettbetaling finnes.
- **Admin-behov fra #7:** søk på navn/e-post/kjøpsdato (Payload list-søk),
  aktiv/utløpt-filter, **CSV-eksport** (liten custom admin-knapp/endpoint —
  Payload har ikke innebygd eksport), redigere/legge til medlemmer manuelt,
  markere `cardPickedUp`.
- **Tilgang:** medlemsregisteret synlig for admin + de redaktørene klienten
  utpeker (rollefelt fra forutsetning 3).

## 6. E-post (Resend)

- Adapter: `@payloadcms/email-resend`, avsender f.eks. `medlem@ekko.no`
  (DKIM/SPF på eget subdomene, rører ikke Workspace-oppsettet).
- E-poster i fase 1: kjøpsbekreftelse (web), valgfri bekreftelse ved dørsalg,
  passord-reset (redaktører — kommer gratis med adapteren).
- GDPR: signer Resends DPA, nevn dem som databehandler i personvernerklæring,
  minimer loggretensjon. EU-only residens krever Pro-plan — kun hvis klienten
  krever det.

## 7. Infra (terraform-payload)

- Nye secrets etter `preview_secret`-mønsteret: `RESEND_API_KEY`,
  `VIPPS_CLIENT_ID`, `VIPPS_CLIENT_SECRET`, `VIPPS_SUBSCRIPTION_KEY`,
  `VIPPS_MSN` (sensitive vars i tfvars → Secret Manager → env med
  `value_source`).
- `admin.ekko.no` (allerede planlagt/underveis) blir base for webhook-URL-ene.
- Vipps test-miljø (`apitest.vipps.no`) med egne test-secrets lokalt.

## 8. GDPR og personvern

- Feltene er minimert (kun docens liste). Ingen sensitive kategorier.
- Personvernerklæring på nettsiden (M0-tekst, M4-publisering): formål,
  behandlingsgrunnlag (avtale), databehandlere (Vipps, Resend, Google Cloud),
  lagringstid.
- **Sletterutine:** manuell i v1 men dokumentert — forslag: medlemmer slettes/
  anonymiseres 2 år etter `validUntil` (avklar med klienten). Ordre beholdes
  anonymisert for regnskap (bokføringsloven: 5 år).
- Innsyn/sletting på forespørsel: admin søker på e-post og sletter — beskriv i
  rutinen.

## 9. Testing

- Enhetsnivå: sesong-/salgsvindulogikk og prisoppslag (ren funksjon — testes
  uten Vipps).
- Vipps MT-miljø: fullt kjøp, avbrutt kjøp, webhook-replay (idempotens),
  fornyelse på eksisterende e-post.
- E2e i testmiljøet lokalt (docker-oppsettet fra migreringen gjenbrukes) før
  prod-avtalen aktiveres; første ekte kjøp verifiseres med egen betaling.

## 10. Milepæler (estimat: effektive utviklingsdager)

- **M0 — Oppstart (kalendertid, start nå):** Vipps-avtale søkes (KYC,
  dager–uker, kritisk sti). Resend-konto + DNS (om ikke alt gjort ved
  redaktør-onboarding). Avklaringene under lukkes med Olav. *~1 d arbeid +
  ventetid.*
- **M1 — Register + admin (2–3 d):** collections + global + roller/tilgang +
  migrasjon + CSV-eksport. **Dørsalg og manuelt register fungerer herfra.**
- **M2 — Betaling (4–6 d):** checkout-endpoint, Vipps Checkout mot MT-miljø,
  webhook med idempotens, bekreftelses-e-post, takk-side-polling, kant-tester.
- **M3 — Frontend (2–3 d):** `/medlemskap` (nb/en) med docens tekst/struktur,
  skjema, takk-side, «utenfor salgsvindu»-visning.
- **M4 — Produksjon (1–2 d + ventetid):** live Vipps-nøkler, terraform apply,
  ekte testkjøp, personvernerklæring publisert, opplæring (registrere
  dørsalg, hente CSV, markere kort hentet).
- **M5 = Fase 2 — Billetter (eget prosjekt):** billettyper/kapasitet per
  arrangement, QR + skanning i dør, refusjoner, rapporter; medlemsrabatt som
  prisregel mot registeret. Beslutning: bygge selv vs. selvdriftet Pretix.

Sum fase 1: **~10–15 utviklingsdager** pluss Vipps-ledetid.

## Status (2026-08-02): RAPPORTER, FELLES KONTO, WALLET OG SKANNER

E2e-verifisert i skyen (mock-betaling):
- **Salgsrapporter**: admin-view **/admin/rapporter** (forhåndsvalg: denne
  måneden, hittil i år, kalenderår + fritt tidsrom) over
  `/api/commerce/reports/sales` — billetter per arrangement/billettype +
  medlemskap, CSV-eksport.
- **Felles konto**: medlemskjøp lenkes til innlogget kunde, /medlemskap
  forhåndsutfylles, og Min side (/konto) viser medlemsstatus (type,
  aktiv/utløpt, medlems-ID) sammen med billettene.
- **Dør-skanner**: /skann på frontenden — admin-innlogging (CMS-kontoen),
  kamera-QR (jsQR), grønn/rød validering, slipp-inn, manuell kode-fallback.
- **Wallet**: komplette kodestier for Apple Wallet (.pkpass) og Google Wallet
  (save-lenke), ENV-GATET og utestet til credentials finnes. Skaff:
  1) **Apple Developer Program** ($99/år) → Pass Type ID-sertifikat →
     env APPLE_PASS_CERT_B64/APPLE_PASS_KEY_B64/APPLE_WWDR_B64/
     APPLE_PASS_TYPE_ID/APPLE_TEAM_ID;
  2) **Google Wallet API issuer-konto** (gratis, onboarding i Google Pay &
     Wallet Console) → GOOGLE_WALLET_ISSUER_ID + service-account-nøkkel
     (GOOGLE_WALLET_SA_KEY_B64) + opprett EventTicket-klassen `ekko_tickets`.
  Frontenden viser knappene automatisk når /commerce/wallet/status melder
  aktivt. Merk: pass-generering MÅ testes ved aktivering.
- Demo-data i skyen: kunde e2e-test@ekko.no med 2 billetter (1 brukt) +
  medlemskap EKKO-2026-0002 — synlig i /admin/rapporter.

## Status (2026-07-31 kveld): FASE 2 (billetter) OGSÅ IMPLEMENTERT (mock)

Billettbutikken er bygget oppå samme fundament og verifisert e2e lokalt:
- **Billettyper rett på events/festivaler** (`Events.ticketTypes`-array): navn,
  pris, antall (tomt antall = kapasiteten til stedet — nytt `capacity`-felt på
  locations-kategorier, fylles av beforeChange-hook), på/av per type.
- **Kundekontoer** (`customers`, egen auth-collection, åpen registrering) —
  samme konto for billetter og medlemskap; billetter knyttes til kontoen og
  vises på `/konto` («Min side») i frontenden med QR-koder.
- **Tickets-collection**: én doc per billett, signert QR-payload (HMAC m/
  PAYLOAD_SECRET, `src/commerce/qr.ts`) — samme payload gjenbrukes av
  fremtidig Apple Wallet-pass (endpoint `/api/commerce/tickets/:code/pass`
  svarer 501 til Apple Developer Pass Type ID-sertifikat er skaffet).
- **Endepunkter**: availability (lager = maks − utstedte), checkout (krever
  kundeinnlogging, pris/lager valideres server-side, maks 10 per ordre),
  my/tickets, send-på-e-post (implementert, IKKE testet — e-post uten adapter
  logges bare), **dørskanning** GET/POST `/api/commerce/scan/:payload`
  (admin-innlogging; verifiserer signatur, markerer brukt, idempotent).
- **Frontend**: `/billetter/:eventSlug` (kjøp + inline login/registrering),
  `/konto` (Min side m/ QR), `/billetter/takk`. QR rendres client-side
  (`qrcode`-pakken).
- Migrasjon: `20260731_205842_ticket_shop`. Verifisert lokalt: kjøp 3
  billetter, lager 200→198 / 50→49, skann → brukt → alreadyUsed, forfalsket
  QR → 400, kunde kan ikke skanne (403). NB: cookie-auth krever Origin-header
  (CSRF) — nettlesere sender den alltid; framtid.ekko.no står i listene.

**DEPLOYET I SKY 2026-07-31/08-01:** hele commerce-laget kjører på
https://admin.ekko.no; membership-config seedet (salg åpent, 300/200 kr);
frontend på https://framtid.ekko.no (passordgate, persistent cookie, noindex).
Gjenstår før reell drift: Vipps-avtale → ekte provider, RESEND_API_KEY i
terraform (e-post er ellers stille), EN-tekster i skjemaene, CSV-knapp i
admin-UI (endepunktet finnes), rolleskille i Users, og Medlemskap-lenke i
menyen (navigasjonen importeres med pass 4, se migration/MIGRATION.md).

## Status (2026-07-31): M1 + M2 (mock) + M3 IMPLEMENTERT

Bygget og verifisert lokalt (dev-miljø, hele kjøpsflyten testet med curl):
collections/global/endpoints i `migration/payload-app/src/{commerce,collections,globals}`,
Resend-adapter (aktiveres av `RESEND_API_KEY`), frontend-ruter
`/medlemskap` + `/medlemskap/takk` i frontend-repoet. Betaling bruker en
**mock-provider** (Vipps har ingen sandbox uten kundeforhold) — tydelig merket
testside, samme fulfilment-kodesti som ekte webhook, sperret når
`PAYMENT_PROVIDER=vipps` settes. Migrasjon generert
(`20260731_155654_membership_commerce`), kjøres i skyen ved neste deploy.
Gjenstår før prod: Vipps-provider (når avtale + signaturrett), RESEND_API_KEY i
terraform, seeding av membership-config, EN-oversettelse av skjematekster,
admin-knapp for CSV (endpoint finnes).

## Opprydding ved cutover (skjemaendringer som er gratis ved fersk re-import)

- **Splitt `categories` i `locations` og `organizers`** — delt liste er
  Craft-arv; steder har egne felter (venue/room/capacity) og driftsbetydning
  for billettkapasitet. Endres i skjema + importpass FØR cutover-importen, så
  fyller den ferske importen to rene collections uten datamigrering. Husk:
  events-relasjonene og frontendens LocationFields-fragment følger med.
- Vurder samtidig: fjerne `navigationNodes`-collectionen (legacy, frontenden
  leser den ikke lenger).

## 11. Avklaringer med Olav (lukkes i M0)

1. **Sesong (docen) vs. +12 mnd (#7)** — planen antar sesong. Bekreft.
2. Sesonggrenser/salgsvinduer eksakt (vår til 30/6? høst til 31/12? — docen
   oppgir bare salgsstart 1/12 og 1/5).
3. Studentverifisering: kun manuelt i dør ved korthenting? (planens antakelse)
4. Refusjonspolicy for medlemskap (angrerett 14 dager ved nettkjøp — tekst på
   siden).
5. Hvem skal ha tilgang til medlemsregisteret?
6. Slette-/anonymiseringsfrist (forslag: 2 år etter utløp).
7. Mailchimp-synk: med i fase 1 eller senere? (feltet `consentNewsletter`
   lagres uansett)
8. MVA på medlemskap — avklar med regnskapsfører (kan avvike fra fritatte
   kulturbilletter).
