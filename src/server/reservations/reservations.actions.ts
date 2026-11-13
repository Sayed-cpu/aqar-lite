import "server-only";
import { reserveUnitSchema } from "@/lib/schemas/sales";
import { createAction } from "../actions/create-action";
import { reserveUnit } from "./reservations.service";

export const reserveUnitAction = createAction(
  { name: "reservations.create", schema: reserveUnitSchema, permission: "reservations:create" },
  reserveUnit,
);
