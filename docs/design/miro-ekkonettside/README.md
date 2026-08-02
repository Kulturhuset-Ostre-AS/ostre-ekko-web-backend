# Miro-brettet «EKKONETTSIDE» (Olavs ønsker)

Kilde: https://miro.com/app/board/uXjVPr_Egno=/ (privat brett fra Olav; delt
visningslenke: https://miro.com/app/board/uXjVPr_Egno=/?share_link_id=76520409478).
Innholdet er transkribert her 2026-08-02 siden brettet ligger utenfor vår
kontroll — selve skjermbildene holdes utenfor git.

Brettet er organisert som fire PROBLEM → LØSNING-seksjoner med «gammel side»
vs. «ny side»-mockups, og røde streker som kobler Craft-adminfelter til
plassering på siden.

## Transkripsjon

### 1. Arrangementsside (Østre-arrangementer)

**Problem:** Det er vanskelig å se når dørene åpner, starttid for en artist og
når arrangementet er ferdig.

**Løsning:** Restrukturere hvordan arrangementsinfo vises: *Dørene åpner,
starttid, ferdig, aldersgrense og praktisk info.*

Ny arrangementsside-mockup (infoblokk):

| Felt | Eksempel |
|---|---|
| Dato / Sted | Fredag 10.4 / Østre |
| Dørene åpner | 22:30 |
| Starttid | 22:30 |
| Ferdig | 03:30 |
| Billetter | Forhåndssalg 120,- / Etter 23:00: 150,- / «kan kjøpes på Ticketco eller i døren ved ledig kapasitet» |
| Aldersgrense | 18 år |
| Praktisk info | «Les mer **her** om tilgjengelighet, vergeordning og ledsagerbillett» (lenke) |

Gul lapp: mellomrom (visuell gruppering) mellom Sted/Dørene åpner,
Ferdig/Billetter, Billetter/Aldersgrense, Aldersgrense/Praktisk info.

Admin-lapper: «Legge til en ny aldersgrense-modul på "information"?» og
«Legge til en ny praktisk info-modul på "information"?»

**Problem (spilleplan):** Artist spiller flere ganger i løpet av en kveld eller
spiller sammen med andre artister flere ganger (faktisk tilfelle: 23:00–00:00
Olav Eggestøl b2b Stine Lundberg; 00:00–01:00 House on Sale b2b Mira Kahrs;
01:00–02:00 House on Sale b2b Stine Lundberg; 02:00–03:30 Olav Eggestøl b2b
Mira Kahrs). **Løsning-forslag:** «Ville en enkel løsning vært og lage et
tekstfelt for spilleplan?» — mockupen viser en «SPILLEPLAN»-seksjon under
Kjøp billetter, med gul lapp «Legge til et nytt tekstfelt "spilleplan"».

Gul lapp (åpent spørsmål): «Hvordan vil endringene påvirke kalender?»

### 2. Festival: tidsplan og artistside

**Problem:** Det er ikke mulig å finne ut når dørene åpner, og vanskelig å lese
når en performance starter og slutter. Oppdatere arrangementsinfo:
«Dørene åpner», «starttid», «ferdig».

**Løsning:** Oppdatere billetter på ekkofest.no. Lage en ny knapp for dørene
åpner og implementere på tidsplan og artistside. Dele opp «åpningstid» til
«starttid» og «ferdig».

- Ny tidsplan: egne «Dørene åpner»-rader (uthevet) per scene/dag.
- Ny artistside: infoblokk med Dørene åpner 19:00 / Starttid 21:00 /
  Ferdig 22:00; «Dagens program» med «Dørene åpner»-rad per scene.
- Gule lapper: «Hvordan løse dørene åpner i backend?», «hvordan løse praktisk
  info? (aldersgrense, tilgjengelighet, vergeordning ++)»
- Blå notater ved admin-skjermbilder: «Angir perioden for hele festivalen»,
  «Angir dag og tidsrom for tidsplan», «Angir dag og tidsrom på artistsider»,
  «Angir spilletid for festival både på tidsplan og artistside».

### 3. Festival: billettside

**Problem:** For mye praktisk informasjon i hver rute under billetter — gjør
det vanskelig å lese. Nedtrekksmenyen fremstår uoversiktlig og uorganisert.
Mål: bedre lesbarhet.

**Løsning:** Oppdatere billetter på ekkofest.no: *aldersgrense, vergeordning,
tilgjengelighet* som strukturerte felter; nedtrekksmeny.

- Gul lapp: «Lage en nedtrekksmeny delt i tre: Festivapass / Dagspass /
  Enkelt billetter» (mockupen viser de tre gruppene med felter Navn, Pris,
  Aldersgrense, Vergeordning, Tilgjengelighet per billett).
- Gule lapper (åpne spørsmål): «Hvilken info vil vi vise under billetter?»,
  «Tilhører vergeordning og tilgjengelighet her?», «Hvordan lenke videre til
  Ticketco?», «Vet ikke hvordan man ordner dette i backenden».

### 4. Festival: arkiv

**Problem:** Arkivet er vanskelig å finne. Lange lineups gjør siden veldig
lang. Mål: finne festivalarkivet lettere.

**Løsning:** Legge til alle tidligere festivaler i nedtrekksmenyen slik at det
ikke åpner opp en ny side. Komprimere lineups. Linke videre til tidligere års
festival-fanziner.

- Gul lapp: gammel løsning — «vis fullt arkiv» åpner egen URL med arkiv.
- Oransje lapp: «Legge til en sorteringsfunksjon på årstall?»
- Grønn lapp: «Trykker man på arkivet åpnes bildevisning av årets Ekko
  fanzine» (mockup viser fanzine-oppslag).

### Løse lapper øverst

«Engelsk», «Om oss / Praktisk info», «Samarbeidspartnere» — stikkord uten
tilhørende mockups (trolig: engelsk versjon, om oss-/praktisk info-innhold og
samarbeidspartner-visning må huskes).
