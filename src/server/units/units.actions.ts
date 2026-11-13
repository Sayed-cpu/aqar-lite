import "server-only";
import { unitInputSchema, unitUpdateSchema } from "@/lib/schemas/units";
import { createAction } from "../actions/create-action";
import { createUnit, updateUnit } from "./units.service";

export const createUnitAction = createAction(
  { name: "units.create", schema: unitInputSchema, permission: "units:create" },
  createUnit,
);

export const updateUnitAction = createAction(
  { name: "units.update", schema: unitUpdateSchema, permission: "units:update" },
  updateUnit,
);
