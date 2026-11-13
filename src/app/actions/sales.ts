"use server";

import { redirect } from "next/navigation";
import type { FormState } from "@/lib/form-state";
import { submitForm } from "@/server/actions/form";
import { approveContractAction, createDraftAction, updateDraftAction } from "@/server/contracts/contracts.actions";
import { recordPaymentAction } from "@/server/payments/payments.actions";
import { reserveUnitAction } from "@/server/reservations/reservations.actions";

export async function reserveUnitForm(_prev: FormState, formData: FormData): Promise<FormState> {
  return submitForm(formData, reserveUnitAction, ({ id }) => redirect(`/reservations/${id}?saved=reserved`));
}

export async function createDraftForm(_prev: FormState, formData: FormData): Promise<FormState> {
  return submitForm(formData, createDraftAction, ({ id }) => redirect(`/contracts/${id}?saved=drafted`));
}

export async function updateDraftForm(_prev: FormState, formData: FormData): Promise<FormState> {
  return submitForm(formData, updateDraftAction, ({ id }) => redirect(`/contracts/${id}?saved=updated`));
}

export async function approveContractForm(_prev: FormState, formData: FormData): Promise<FormState> {
  return submitForm(formData, approveContractAction, ({ id }) => redirect(`/contracts/${id}?saved=approved`));
}

// A replayed submission lands on the same page as the first one: the payment
// it recorded is already in the list, and no second one was made.
export async function recordPaymentForm(_prev: FormState, formData: FormData): Promise<FormState> {
  return submitForm(formData, recordPaymentAction, ({ contractId, replayed }) =>
    redirect(`/contracts/${contractId}?saved=${replayed ? "paid-once" : "paid"}`),
  );
}
