"use server";

import { redirect } from "next/navigation";
import type { FormState } from "@/lib/form-state";
import { createClientAction, updateClientAction } from "@/server/clients/clients.actions";
import { submitForm } from "@/server/actions/form";

export async function createClientForm(_prev: FormState, formData: FormData): Promise<FormState> {
  return submitForm(formData, createClientAction, ({ id }) => redirect(`/clients/${id}?saved=created`));
}

export async function updateClientForm(_prev: FormState, formData: FormData): Promise<FormState> {
  return submitForm(formData, updateClientAction, ({ id }) => redirect(`/clients/${id}?saved=updated`));
}
