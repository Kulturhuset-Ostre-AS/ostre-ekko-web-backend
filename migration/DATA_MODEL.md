# EKKO / Østre content data model

The model is shared by the Craft 3 source and the Payload target (the migration
preserves it). It centers on **events** that link **performances** and **artists**,
classified by **category** taxonomies (locations, organizers), with rich **Matrix**
body content and **assets** from four media volumes. Two locales: `en`, `nb`.

## Entity-relationship diagram

```mermaid
erDiagram
    EVENTS ||--o{ PERFORMANCES : "performances[]"
    PERFORMANCES }o--o{ ARTISTS : "artist[]"
    EVENTS }o--|| LOCATION_CAT : "location"
    EVENTS }o--|| ORGANIZER_CAT : "organizer"
    EVENTS ||--o{ COMPLEX_CONTENT : "complexContent (Matrix)"
    NEWS ||--o{ COMPLEX_CONTENT : "body (Matrix)"
    ARENA ||--o{ COMPLEX_CONTENT : "body (Matrix)"

    EVENTS }o--o{ MEDIA : "eventFeaturedPhoto / gallery"
    ARTISTS }o--o{ MEDIA : "artistFeaturedPhoto / images"
    NEWS }o--o{ MEDIA : "newsPhoto"
    COMPLEX_CONTENT }o--o{ MEDIA : "imageBlock.image"

    EVENTS {
        int    craftId PK
        string title
        string slug
        date   date
        date   dateEnd
        bool   isMultiDay
        bool   singlePage
        time   openingTime
        time   closingTime
        rich   intro
        rich   description
        string ticketLink
    }
    PERFORMANCES {
        int    craftId PK
        string title
        string slug
        date   date
        time   startTime
        time   endTime
    }
    ARTISTS {
        int    craftId PK
        string title
        string slug
        string artistName
        string artistMeta
        rich   bio
    }
    NEWS {
        int    craftId PK
        string title
        string slug
        date   postDate
    }
    ARENA {
        int    craftId PK
        string title
        string slug
    }
    LOCATION_CAT {
        int    craftId PK
        string title
        string venue
        string room
    }
    ORGANIZER_CAT {
        int    craftId PK
        string title
    }
    MEDIA {
        int    craftId PK
        string filename
        string source "volume handle"
        string artistName
        string ekstraInfo
        int    width
        int    height
    }
    COMPLEX_CONTENT {
        string blockType "text2 | video | embed | imageBlock"
        rich   text
        string videoUrl
        string code
    }
```

## Section map (Craft → Payload)

```mermaid
flowchart LR
    subgraph Craft3["Craft 3 sections"]
      direction TB
      S1["about / archive / homepage<br/>legal / oestre / ekko_festival_info<br/><i>(single)</i>"]
      S2["arena / events / news<br/><i>(channel)</i>"]
      S3["artists / performance<br/><i>(structure)</i>"]
      S4["locations / organizers<br/><i>(categories)</i>"]
      S5["artistPhotos / eventPhoto<br/>mixtapes / userPhotos<br/><i>(asset volumes)</i>"]
    end
    subgraph Payload["Payload 3"]
      direction TB
      G["Globals<br/>about, archive, homepage,<br/>legal, oestre, ekko_festival_info"]
      C["Collections<br/>arena, events, news,<br/>artists, performance"]
      CAT["categories<br/>(group: locations | organizers)"]
      M["media<br/>(source = volume handle)"]
    end
    S1 --> G
    S2 --> C
    S3 --> C
    S4 --> CAT
    S5 --> M
```

## Field-type mapping

| Craft field | Count | Payload |
|---|---|---|
| PlainText | 38 | `text` / `textarea` |
| Redactor | 18 | `richText` (lexical) |
| Lightswitch | 12 | `checkbox` |
| Date | 11 | `date` |
| Assets | 11 | `upload` → `media` |
| Entries | 9 | `relationship` |
| Matrix | 8 | `blocks` |
| Dropdown | 3 | `select` |
| Color | 3 | `text` (hex) |
| Categories | 2 | `relationship` → `categories` |
| Tags | 1 | `relationship` → `tags` |
| Link | 1 | `group { label, url }` |
| Preparse | 1 | dropped (derived) |

## The `complexContent` Matrix → Payload blocks

```mermaid
flowchart TB
    CC["complexContent (Matrix)"] --> T["block: text2<br/>{ richText text }"]
    CC --> V["block: video<br/>{ text videoUrl }"]
    CC --> E["block: embed<br/>{ text code }"]
    CC --> I["block: imageBlock<br/>{ upload image → media }"]
```

## Relationship cheat-sheet

- **events.performances[]** → performance entries (one event → many performances)
- **performance.artist[]** → artist entries (many-to-many)
- **events.location** → category (locations group; carries `venue`, `room`)
- **events.organizer** → category (organizers group)
- **\*.featuredPhoto / gallery / images** → `media` (upload, hasMany)
- **structures** (`artists`, `performance`) keep tree order via `order` +
  `parentCraftId` on each Payload doc.

> Diagrams render on GitHub and in the VS Code Markdown preview (Mermaid).
