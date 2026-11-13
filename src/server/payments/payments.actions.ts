import "server-only";
import { recordPaymentSchema } from "@/lib/schemas/sales";
import { createAction } from "../actions/create-action";
import { recordPayment } from "./payments.service";

export const recordPaymentAction = createAction(
  { name: "payments.create", schema: recordPaymentSchema, permission: "payments:create" },
  recordPayment,
);
