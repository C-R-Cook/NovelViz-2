export type DataFlowSectionId = "books" | "images" | "questions";

export type DataFlowSection = {
  id: DataFlowSectionId;
  title: string;
  summary: string;
  mermaid: string;
  notes: string[];
  keyFiles: { label: string; path: string }[];
};

export const DATA_FLOW_SECTIONS: DataFlowSection[] = [
  {
    id: "books",
    title: "Book ingest",
    summary:
      "Gutenberg bulk ingest is an optional path into the same chapter/chunk/embedding pipeline used when a partner or admin uploads an EPUB. Both end at pending_review until an admin publishes.",
    mermaid: `flowchart TB
  subgraph guten["Optional — Gutenberg bulk CLI"]
    GF["npm run gutenberg-fetch"] --> GX["Gutendex API"]
    GX --> QJ["scripts/gutenberg-queue.json"]
    QJ --> GA["Admin UI: approve queue<br/>/admin/gutenberg-import"]
    GA --> GI["npm run gutenberg-ingest"]
    GI --> DL["Download EPUB<br/>.epub.noimages from Gutenberg"]
    DL --> OL1["Open Library search<br/>Cover: EPUB → Gutendex → OL"]
    OL1 --> CL1["Cloudinary → coverImageUrl"]
    CL1 --> BK1["Create Book<br/>gutenbergId · processing"]
  end

  subgraph manual["Manual — partner / admin"]
    PF["Optional: EPUB metadata prefill<br/>POST /api/partner/books/epub-metadata"] --> CR["POST /api/partner/books<br/>Book status = draft"]
    CR --> ING["POST /api/admin/books/id/ingest<br/>multipart EPUB or TXT"]
  end

  BK1 --> CORE
  ING --> CORE

  subgraph core["Shared processing — lib/ingestion.ts"]
    CORE["processBook: parse EPUB spine"] --> GN["OpenAI gpt-4o-mini<br/>genre from dc:subject"]
    GN --> CH["Replace Chapter rows<br/>delete ReadingProgress first"]
    CH --> EM["OpenAI text-embedding-3-small<br/>chunk + embed"]
    EM --> CK["Insert Chunk rows<br/>pgvector embedding"]
    CK --> PR["Book → pending_review<br/>+ genre + token counts"]
  end

  subgraph manual_extra["Manual ingest only — after chapters"]
    ING --> CV["EPUB cover → Cloudinary"]
    CV --> OL2["Open Library metadata only<br/>non-blocking patch"]
  end

  PR --> PUB["Admin: status → published<br/>Discover requires cover"]

  style guten fill:#1a1510,stroke:#8B4513,color:#e8e0d8
  style manual fill:#101418,stroke:#4a6a8a,color:#e8e0d8
  style core fill:#121a14,stroke:#3d6b4f,color:#e8e0d8
  style manual_extra fill:#101418,stroke:#4a6a8a,color:#e8e0d8`,
    notes: [
      "Gutenberg: Open Library + cover run before the Book row exists; genre failure leaves draft with no chunks.",
      "Manual: Book exists first; cover from EPUB only during ingest; Open Library patches description/year/key after success.",
      "Re-ingest: same POST ingest route; allowed when status is draft, pending_review, published, or unlisted.",
      "Oversized EPUB (>4.5 MB illustrated): queue entry flagged skipAutoIngest; use no-images URL or manual upload.",
    ],
    keyFiles: [
      { label: "Gutenberg fetch", path: "scripts/gutenberg-fetch.ts" },
      { label: "Gutenberg ingest", path: "scripts/gutenberg-ingest.ts" },
      { label: "OL + cover (Gutenberg)", path: "lib/open-library-cover.ts" },
      { label: "HTTP ingest", path: "app/api/admin/books/[id]/ingest/route.ts" },
      { label: "Partner create", path: "app/api/partner/books/route.ts" },
      { label: "Parse / chunk / embed", path: "lib/ingestion.ts" },
      { label: "Runbook", path: "docs/gutenberg-import.md" },
    ],
  },
  {
    id: "images",
    title: "Image generation",
    summary:
      "Reader Imagine in the library runs RAG over book chunks, then fal.ai for the image and Cloudinary for storage. Gallery, likes, and feature requests are separate read/social paths.",
    mermaid: `flowchart TB
  subgraph imagine["Production Imagine — POST /api/imagine"]
    UI["Library panel: Imagine"] --> RP["Requires ReadingProgress<br/>POST /api/progress/bookId"]
    RP --> AUTH["Auth + image usage limit"]
    AUTH --> SUB["Anthropic: extract subject"]
    SUB --> EMB["OpenAI: embed user prompt + subject"]
    EMB --> PAR
    subgraph PAR["Parallel vector search — same chapter cap"]
      V1["pgvector top 5<br/>subject match"]
      V2["pgvector top 5<br/>scene / prompt match"]
    end
    EMB --> V1
    EMB --> V2
    V1 --> MERGE["Merge + dedupe chunks<br/>max 8"]
    V2 --> MERGE
    MERGE --> PROMPT["Anthropic: enrich T2I prompt"]
    PROMPT --> FAL["fal.ai subscribe<br/>model by role"]
    FAL --> CDN["Cloudinary upload<br/>from fal URL"]
    CDN --> GI["GeneratedImage.create"]
    GI --> BILL["consumeTopUp image"]
  end

  subgraph gallery["Gallery & social"]
    GI --> PUB{"isPublic?"}
    PUB -->|yes| GAL["GET /api/gallery/book/id<br/>spoiler lock via progress"]
    GAL --> LIKE["POST like → Like + likeCount"]
    GI --> FEAT["POST /api/feature-requests"]
    FEAT --> ADM["Admin approve → isFeatured"]
  end

  subgraph t2i["Admin T2I tester — isolated"]
    T2I["POST /api/admin/t2i-test"] --> FAL2["fal.ai"]
    FAL2 --> DISK["Local JPEG t2i-output/<br/>not GeneratedImage"]
  end

  style imagine fill:#121a14,stroke:#3d6b4f,color:#e8e0d8
  style PAR fill:#1a1f24,stroke:#C49A3C,color:#e8e0d8
  style gallery fill:#101418,stroke:#4a6a8a,color:#e8e0d8
  style t2i fill:#1a1510,stroke:#8B4513,color:#e8e0d8`,
    notes: [
      "Subject and scene vector searches use the same embedding batch; results merge before prompt enrichment.",
      "Non-admin users get xai/grok-imagine-image; admins can pick fal models in the tester only.",
      "Gallery spoiler blur uses ReadingProgress + per-book and global spoiler settings.",
      "Book covers (ingest / Gutenberg) use a separate Cloudinary path under novelviz/covers.",
    ],
    keyFiles: [
      { label: "Imagine API", path: "app/api/imagine/route.ts" },
      { label: "fal routing", path: "lib/imagine-fal.ts" },
      { label: "Library UI", path: "app/(reader)/(app)/library/library-book-panel.tsx" },
      { label: "Gallery API", path: "app/api/gallery/book/[bookId]/route.ts" },
      { label: "T2I tester", path: "app/admin/t2i-tester/t2i-tester-client.tsx" },
    ],
  },
  {
    id: "questions",
    title: "Questions (Q&A) & gallery comments",
    summary:
      "Library Questions use the Query model and the same chunk RAG pattern as Imagine, without fal.ai. Gallery comments are separate: they attach to GeneratedImage, run spoiler scans in parallel, and drive notifications.",
    mermaid: `flowchart TB
  subgraph query["Library Q&A — POST /api/query"]
    QUI["Library panel: Questions"] --> QRP["Requires ReadingProgress"]
    QRP --> QLIM["Auth + query usage limit"]
    QLIM --> QEMB["OpenAI: embed question"]
    QEMB --> QVEC["pgvector top 5 chunks"]
    QVEC --> QANS["Anthropic: answer from context"]
    QANS --> QROW["Query.create"]
    QROW --> QBILL["consumeTopUp query"]
  end

  subgraph comments["Gallery comments — POST /api/comments"]
    CUI["gallery-image-comments"] --> CVAL["Validate public image"]
    CVAL --> CROW["Comment.create VISIBLE"]
    CROW --> SCAN["Spoiler scan async<br/>Anthropic JSON"]
    SCAN -->|safe| OK["Stay VISIBLE"]
    SCAN -->|spoiler| HID["HIDDEN_SPOILER<br/>+ notification author"]
    CGET["GET /api/comments"] --> VIS["comment-visibility<br/>progress + spoiler settings"]
  end

  subgraph mod["Moderation parallel paths"]
    FLAG["POST .../flag"] --> PEND["PENDING_CONTENT_REVIEW<br/>notify author + admins"]
    PATCH["PATCH .../commentId"] --> ACT["reword · reinstate<br/>confirm_spoiler · moderate"]
    DASH["Dashboard queues"] --> PATCH
  end

  subgraph notif["Notifications"]
    HID --> NB["createNotification"]
    PEND --> NB
    ACT --> NB
    NB --> BELL["GET /api/notifications<br/>notifications-bell"]
  end

  style query fill:#121a14,stroke:#3d6b4f,color:#e8e0d8
  style comments fill:#101418,stroke:#4a6a8a,color:#e8e0d8
  style mod fill:#1a1510,stroke:#8B4513,color:#e8e0d8
  style notif fill:#1a1f24,stroke:#C49A3C,color:#e8e0d8`,
    notes: [
      "Query and Imagine both require saved reading progress and respect subscription usage limits.",
      "Comment spoiler scan runs after create (async via after()); safe comments stay visible immediately.",
      "Flagged comments go to admin Flagged queue; spoiler-hidden to Spoiler Comments queue.",
      "Queries do not use comments, notifications, or gallery — only GeneratedImage comments do.",
    ],
    keyFiles: [
      { label: "Query API", path: "app/api/query/route.ts" },
      { label: "Comments API", path: "app/api/comments/route.ts" },
      { label: "Spoiler scan", path: "lib/comment-scan.ts" },
      { label: "Visibility", path: "lib/comment-visibility.ts" },
      { label: "Notifications", path: "lib/notifications.ts" },
    ],
  },
];
