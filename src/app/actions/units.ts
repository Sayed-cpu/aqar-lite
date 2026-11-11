"use server";

import { redirect } from "next/navigation";
import type { FormState } from "@/lib/form-state";
import { submitForm } from "@/server/actions/form";
import { createUnitAction, updateUnitAction } from "@/server/units/units.actions";

export async function createUnitForm(_prev: FormState, formData: FormData): Promise<FormState> {
  return submitForm(formData, createUnitAction, ({ id }) => redirect(`/units/${id}?saved=created`));
}

export async function updateUnitForm(_prev: FormState, formData: FormData): Promise<FormState> {
  return submitForm(formData, updateUnitAction, ({ id }) => redirect(`/units/${id}?saved=updated`));
}
