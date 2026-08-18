// Not in API-001 (added post-launch, prioritized per DL-ARCH-009 as the
// board/investor document-tooling integration). PandaDoc's scope model is
// much simpler than Google/Microsoft's per-resource scopes - just "read"
// and "write" cover the whole API surface, confirmed against PandaDoc's
// own OAuth reference docs.

export const PANDADOC_SCOPES = ["read", "write"];

export const PANDADOC_PROVIDER = "pandadoc";
