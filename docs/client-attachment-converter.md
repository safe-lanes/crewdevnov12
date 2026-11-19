# Client Attachment Converter

The Client Attachment Converter is a separate conversion workflow. It never
calls the Employee ID / Attachment Ref importer and never writes attachment
rows to SAIL.

## Workflow

1. List active profiles with `GET /api/v2/crew-pool/attachment-converter/profiles`.
2. Upload a ZIP for analysis with `POST /api/v2/crew-pool/attachment-converter/analyze?profileId=<id>`.
3. Review the normalized input, candidate crews, candidate ERP records, and report.
4. Submit validated manual resolutions when a crew, category, or record is ambiguous.
5. Generate the output with `POST /api/v2/crew-pool/attachment-converter/convert?profileId=<id>`.
6. Save the returned `convertedZip` and conversion report. The generated ZIP is not imported automatically.

The analyze and convert endpoints accept a raw ZIP body. A JSON body with a
base64 `fileData` field is also accepted; manual resolutions may be supplied in
the `resolutions` array.

## Profile architecture

Profiles are validated with Zod and contain metadata, version, tenant scope,
root-folder handling, parser strategy, category aliases, supported file types,
validation requirements, and section activation. A profile selects a named,
reviewed parser strategy; it cannot execute JavaScript, SQL, or other supplied
expressions.

Profile `rsms-profile-a` currently implements:

```text
<optional ZIP wrapper>/<Crew Name>/<Crew Name>. <Document Name>.pdf
```

Its active section is D3 Training. Names such as `AFF`, `ADV OIL TANKER`, and
`ADV CHEMICAL TANKER` are document/course names, not categories. Profile A
first checks approved category aliases and then resolves an unmatched document
name against the active D3 Training records. That fallback is safe only when
exactly one ERP record matches; zero matches are skipped and multiple matches
remain manual review. The parser emits the common normalized input format,
independent of the output format.

## Resolution and output rules

The D3 resolver matches the parsed crew name to a SAIL crew and the document
name exclusively to `crew_training_courses.abbr` for that crew. Matching ignores
case and leading, trailing, or repeated whitespace. `training_course`, `course_id`,
and `certificate_no` are not automatic matching fields; the full course name
remains available for report display. For example, `ADV CHEMICAL TANKER` matches
`abbr = ADV CHEMICAL TANKER`, even when `training_course` is
`ADVANCED CHEMICAL TANKER TRAINING`. Blank abbreviations cannot match. Zero
matches are skipped; multiple matches require manual review. It reads the record's stored
`attachment_ref`; it never constructs one from a naming convention.

Only a unique, validated mapping is written to the converted ZIP:

```text
<Employee ID>/<actual attachment_ref>/<original filename>
```

Unmatched, ambiguous, malformed, unsupported, duplicate-output, or failed files
are excluded and reported. Manual resolutions are accepted only when the
selected crew, record, section, and current database `attachment_ref` all
validate again at conversion time.

Future sections use the same section resolver contract. They remain inactive
until their reviewed resolver and representative samples are implemented.
