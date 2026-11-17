# Approval engine — vendored copy

This folder is an **unchanged copy** of the approval engine from the Technical module (PMS).

- Source repo: Technical module (PMS), branch `replit_dev`
- Source commit: `2e12c5457`
- Source path: `server/modules/approval-engine/`
- Copied: 2026-11-17

## Rules

- Do **not** edit files in this folder. Make the change in the Technical module first, then copy the folder again and update this file.
- `__tests__/importBoundary.test.ts` fails the build if any file here imports from outside this folder.
- Crewing's wiring lives in `server/v2/approvals/` (host layer), never here.

## SHA-256 per file (at copy time)

```text
d6a5e8c20f0b3bd9a02baf73daf8f6134b86189760e67e7f9bc113014cae129b *./INTEGRATION-GUIDE.md
e0fe2ea0b95891ab81cddc58ebae592e56160f62764c43d71c8e63ad8e1a6cbb *./__tests__/importBoundary.test.ts
73b458d8793fb2ffe38aa66a3bad3f158c4af94ec839d407df8c273202cd7c3e *./__tests__/statusOrdering.test.ts
61d792e4402bd5ba41866174160b7eb2384ff1b111a703ba7153d75e81a6fef6 *./client/ApprovalEngineAdmin.tsx
32cb87458c78b7a5bdf09d3c3dbf328f260e655526be56f38930596872e68c79 *./client/ConfiguredApproverRole.tsx
b9e554311101351321746a3e7bb5324cd3f2268850face8ede5dea13b4aef859 *./core/engine.ts
eb6ed9448a675c7ab2597ec6935096e91042670aefab651c7ec4ab1ad2f07654 *./core/registry.ts
43ddc934c672ad4bb5050ef3bbe755c3705c50ed9de3ba2878138c075445a804 *./core/repository.ts
d2913aa4b21a5d297a3b0557cad6b643e797255f51867d1944753565fcd38699 *./core/types.ts
b0ad1ac57b173746c0e32c1a99104b46ad37c0996604aadcd51cafe7d069cf0a *./core/validateWorkflow.ts
ec9cb860f4af9384bb2f9d1a8abce572b9b8cbe4f22926358e278456eae45759 *./db/drizzleRepository.ts
eb372866beed938b7daae93361d47f7f3434a9b699cd83dddba104d23f5d8c8b *./db/schema.ts
ea9c7277ce4351b460a38a8822019296645831d89bfb5567bd5fc1bff5e4ee2a *./http/router.ts
d0d1a5eecad381c8059710143058011c356d663a40fa6727db32f307069b5300 *./index.ts
```
