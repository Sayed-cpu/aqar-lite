import "server-only";
import { clientInputSchema, clientUpdateSchema } from "@/lib/schemas/clients";
import { createAction } from "../actions/create-action";
import { createClient, updateClient } from "./clients.service";

export const createClientAction = createAction(
  { name: "clients.create", schema: clientInputSchema, permission: "clients:create" },
  createClient,
);

export const updateClientAction = createAction(
  { name: "clients.update", schema: clientUpdateSchema, permission: "clients:update" },
  updateClient,
);
