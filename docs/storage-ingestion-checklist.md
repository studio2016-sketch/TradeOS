# Research file ingestion readiness

TradeOS uses a private Neon Object Storage bucket and a PostgreSQL artifact manifest.

A functioning upload gateway requires server-side user authentication, object-level authorization, an object-storage signing capability, and integrity verification before registering files. Do not expose unsigned upload endpoints or accept client-provided owner identifiers as authentication.

Operational acceptance test: authorized upload, duplicate rejection, denied anonymous access, readback checksum, and immutable provenance.
