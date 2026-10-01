# Company Form stage and submission persistence

## Stages

Subject types and their stages are registry data, not a fixed stage enum.
The crew-assignment registry declares **Before joining**, **On board**, and
**At sign-off**. Future subjects can declare different stages, or no stages,
without changing the version-table structure.

A draft may have no stage. A selected stage must belong to the form's subject.
Release requires a stage only when the subject declares stages. A released
version's stage and ownership cannot change, and it cannot be downgraded to
draft to bypass that rule. Standard Forms have no Company stage.

The Admin editor loads the subject's stages from the registry and permits
selecting or clearing a draft stage. Released versions show their stage
read-only. This authoring endpoint is not a submission-reading endpoint;
submission readers remain separate work under requirement 18.

## Why both reference constraints and triggers

The version stores a server-maintained subject mirror alongside its nullable
stage key. Composite foreign keys bind that mirror to the parent form's subject
and bind the selected stage to the corresponding subject-stage registry entry.
These references also prevent deleting or renaming a referenced stage.

Triggers derive the mirror, enforce the release-only presence rule, and protect
released stage/ownership from changes. A foreign key alone cannot require a
nullable draft field only at release or test whether a subject declares any
stages. Per-subject transaction locks serialize registry edits and version
release checks. Adding a first stage is refused while that subject has
stage-less released versions, rather than silently invalidating them.

## Historical mapping

Migration 0226 maps only the approved MARPOL Declaration version 01
(`3a0ded43-41a4-4460-a6b1-2cc59b0409ba`) to `before_joining`.
The six existing drafts retain NULL stages. A tenant without that version needs
no mapping; other unclassified releases require explicit approval instead of
an inferred stage.

## Submission storage

The generic parent records subject type/reference, form UUID, pinned released
version UUID, stage snapshot, status, completion time, and audit fields.
It enforces one submission per form and subject. Subject, form/version pin, and
stage snapshot are immutable after creation.

Crew-assignment linkage is a separate subject-specific relation. Its assignment
foreign key restricts deletion, and its subject reference must exactly match
the parent. Different forms may have submissions for the same assignment.
The generic parent has no crew-assignment assumption.

## Responsibility and signatures

Migration 0227 adds seafarer section responsibility without a role or department
companion; role and department modes retain their required targets.
Migration 0228 allows an officer's frozen designation in `signer_rank`, while
legacy NULL values remain valid. Neither migration backfills existing signatures.
Their guarded rollback scripts are manual and are not run by the migration
runner. Signing identity, designation capture, and submission APIs are not
implemented by these persistence changes.