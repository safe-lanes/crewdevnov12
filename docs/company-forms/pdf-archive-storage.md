# Private immutable PDF storage and rollout

Canonical PDFs are stored as private bytes in the existing tenant PostgreSQL
database, not workspace uploads. This supplies durable storage without introducing
a second storage service: the unique snapshot key, bytes, checksums, renderer/font
versions, logo version, page count and publication event commit atomically.
Database backups include the archive. Only scoped application download routes
read the bytes; the browser never receives a filesystem or public object URL.

This deliberately implements the proposed private archive with transactional
database objects rather than a separate object-store upload. A crash before
commit publishes nothing; a crash after commit is recovered by reading the unique
existing archive entry, never overwriting it. Rendering is outside form completion.
Original archive entries and preparation events are append-only.

Real-form generation is disabled by a server constant with no environment or
browser override. Only specifically registered layout samples can be prepared.
Main-preview samples must match both the database registration and the committed
fixture manifest, including the cluster/database identity and exact form,
assignment and vessel. Automated samples require the registered isolated test
database identity. Production and unregistered real forms are refused.

The sample worker resumes durable pending requests after restart. Failure records
are visible and await an explicit Fill in-authorized retry. Successful files are
never regenerated. No real-form rollout is part of this slice.
