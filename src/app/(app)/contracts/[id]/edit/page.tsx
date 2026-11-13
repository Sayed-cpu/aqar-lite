import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ContractForm } from "@/app/(app)/contracts/contract-form";
import { PageHeader } from "@/components/ui";
import { minimumFinalPrice } from "@/domain/contracts";
import { formatSar, toSarString } from "@/lib/money";
import { requirePermission, tenantOf } from "@/server/auth/current-user";
import { getContract } from "@/server/contracts/contracts.service";
import { uuidOrNotFound } from "@/server/route-params";

export const metadata: Metadata = { title: "تعديل مسودة العقد — عقار لايت" };

export default async function EditContractPage({ params }: PageProps<"/contracts/[id]/edit">) {
  const session = await requirePermission("contracts:create_draft");
  const id = uuidOrNotFound((await params).id);
  const contract = await getContract(tenantOf(session), id);
  if (!contract || contract.salesRepId !== session.userId) notFound();
  // Approved, or its reservation ran out: the contract page says which.
  if (contract.status !== "draft" || !contract.reservationLive) redirect(`/contracts/${contract.id}`);

  return (
    <div className="space-y-5">
      <PageHeader
        back={{ href: `/contracts/${contract.id}`, label: "العقد" }}
        title={`تعديل مسودة عقد الوحدة ${contract.unitLabel}`}
        description={`للعميل ${contract.clientName} — سعر الوحدة ${formatSar(contract.listPrice)}`}
      />
      <ContractForm
        mode="edit"
        contractId={contract.id}
        priceRange={`بين ${formatSar(minimumFinalPrice(contract.listPrice))} و${formatSar(contract.listPrice)} (خصم 5% على الأكثر)`}
        cancelHref={`/contracts/${contract.id}`}
        values={{
          finalPrice: toSarString(contract.finalPrice),
          downPayment: toSarString(contract.downPayment),
          installmentCount: String(contract.installmentCount),
          startDate: contract.startDate,
        }}
      />
    </div>
  );
}
