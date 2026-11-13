import "server-only";
import { approveContractSchema, contractDraftSchema, contractUpdateSchema } from "@/lib/schemas/sales";
import { createAction } from "../actions/create-action";
import { approveContract, createDraft, updateDraft } from "./contracts.service";

export const createDraftAction = createAction(
  { name: "contracts.create_draft", schema: contractDraftSchema, permission: "contracts:create_draft" },
  createDraft,
);

// Editing a draft is part of drafting it; the service holds it to the rep's own drafts.
export const updateDraftAction = createAction(
  { name: "contracts.update_draft", schema: contractUpdateSchema, permission: "contracts:create_draft" },
  updateDraft,
);

export const approveContractAction = createAction(
  { name: "contracts.approve", schema: approveContractSchema, permission: "contracts:approve" },
  approveContract,
);
