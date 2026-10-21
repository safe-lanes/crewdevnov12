# Reserved policy for slice 5 — not implemented in slice 4

Approved 21-Oct-2026:

- Per-tenant setting: **Block mandatory courses expiring during contract**.
- Default **OFF** for every tenant.
- OFF: mandatory **Expires during contract** warns; it does not block.
- ON: that state blocks, with override only through **Override training
  compliance**, never **Override checklist**.
- Recommended courses never become blocking through this setting.

Slice 4 must not add the setting, enforcement or override behaviour.
