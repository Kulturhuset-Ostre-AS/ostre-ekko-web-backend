# Cloudflare: DNS og redirect-regler (aug. 2026)

Dokumenterer endringene gjort i Cloudflare-dashbordet/-API-et 7.–8. aug. 2026.
Disse ligger IKKE i terraform — de administreres i Cloudflare-kontoen
(konto-ID `5acd02207b1e04b1cf36e450fa2cd175`) under hver sones **Rules →
Overview** og **DNS → Records**.

## ekkofest.no — ren redirect-sone

Flyttet fra Gigahost (navnetjenere byttet hos registrar 7. aug. 2026).
Domenet er kun videresending + e-post; det finnes ingen origin.

### DNS

| Oppføring | Verdi | Formål |
|---|---|---|
| `A @` | `192.0.2.1` (proxied) | Dummy (TEST-NET) — finnes bare så kanten svarer; redirect-regelen tar over før noe origin kontaktes |
| `CNAME *` | `ekkofest.no` (proxied) | Fanger alle underdomener (www, ekko, thefix, www.ekko, www.thefix) |
| `MX @` | `1 smtp.google.com` | Google Workspace (modernisert fra det gamle femrekords-oppsettet) |
| `TXT @` | `"v=spf1 include:_spf.google.com ~all"` | SPF (manglet helt før aug. 2026) |
| `TXT _dmarc` | `"v=DMARC1; p=none"` | DMARC (kandidat for `p=quarantine` senere) |
| `CNAME k2/k3._domainkey` | `dkim2/3.mcsv.net` | Mailchimp-DKIM — **må bevares** (nyhetsbrev) |

### Redirect-regel (Rules → Redirect Rules)

Alle vertsnavn (`ekkofest.no` + `*.ekkofest.no`) → **301
`https://ekko.no/festival`**. Aldri hardkod årets festival-slug her —
`/festival`-ruten i frontenden redirecter selv til gjeldende utgave styrt av
`linkedFestival`-feltet i CMS-et. (Gigahost-forwarden pekte hardkodet på
`/festival/ekko-xxiii` og ville råtnet ved neste festivalskifte.)

Kjent begrensning: gratis Universal SSL dekker kun ett undernivå, så
`www.ekko.ekkofest.no` og `www.thefix.ekkofest.no` virker over http, men gir
sertifikatfeil over https. Bevisst akseptert (Advanced Certificate Manager
koster ~$10/mnd og trafikken er neglisjerbar).

## ekko.no — stenging av det gamle Craft-nettstedet på api.ekko.no

`api.ekko.no` (Craft-VM-en bak Cloudflare-proxy) serverte fortsatt hele det
gamle malbaserte nettstedet i roten etter at ekko.no gikk over til
JS-frontenden. Én redirect-regel i ekko.no-sonen stenger det:

**Hvis** `http.host = api.ekko.no` **og** stien IKKE matcher unntakene under
→ **301 `https://ekko.no/{samme sti}`** (query bevares). Frontendens
`_redirects` oversetter så gamle adresser (`/nyheter/*`, `/events/*`, …) til
ny struktur — gamle søketreff flyttes i stedet for å dø.

### Unntak som MÅ bestå (produksjonskritiske)

| Sti | Brukes av |
|---|---|
| `/api` | GraphQL-endepunktet ekko.no-frontenden leser alt innhold fra |
| `/admin` | **Craft-adminen i produksjon er `api.ekko.no/admin`** (ikke cms.ekko.no som eldre docs antyder) |
| `/index.php` med query som starter med `p=admin` | Craft-kontrollpanelets actions (innlogging, lagring). Uten dette feiler CP-innlogging med CORS-feil — skjedde 8. aug., fikset samme dag |
| `/uploads/`, `/cpresources/`, `/media/` | Media bak frontendens `/img/`-kantproxy |

### Ved endringer

- Endrer du unntakslisten: **verifiser Craft-innlogging umiddelbart etterpå**
  (`api.ekko.no/admin` + selve login-postingen).
- Regelendringer propagerer til kant-nodene i løpet av ~1–2 min — vekslende
  svar rett etter endring er normalt.
- Hele stengingen reverseres ved å slette regelen (Rules → Overview i
  ekko.no-sonen).
- Ved Payload-cutover kan regelen strammes ytterligere (f.eks. fjerne
  `/api`-unntaket når Craft-GraphQL pensjoneres).
