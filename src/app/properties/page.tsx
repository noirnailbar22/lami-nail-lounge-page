import { db } from "@/lib/db";
import { parseNeeds } from "@/lib/clients/needs";
import { PageHeader } from "@/components/bits";
import { SearchWorkspace } from "@/components/search-workspace";
import { LISTING_SOURCES } from "@/lib/properties/sources";

export const dynamic = "force-dynamic";

export default async function PropertiesPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const { client: clientId } = await searchParams;
  const clients = await db.client.findMany({ select: { id: true, name: true, needs: true }, orderBy: { name: "asc" }, take: 2000 });
  const count = await db.property.count();
  const selected = clients.find((c) => c.id === clientId);
  return (
    <div>
      <PageHeader title="Tìm nhà" desc={`Tìm trong ${count} căn đã nhập (CSV / nhập tay / link tham chiếu). Mức phù hợp với khách và nhận định deal được tách riêng.`} />
      <p className="text-xs text-muted-foreground mb-4">
        Nguồn: {LISTING_SOURCES.map((s) => `${s.name}: ${s.status === "active" ? "hoạt động" : s.status === "blocked" ? "chưa có quyền truy cập" : "thủ công"}`).join(" · ")}
      </p>
      <SearchWorkspace
        clients={clients.map((c) => ({ id: c.id, name: c.name }))}
        initialClientId={selected?.id ?? ""}
        initialFilters={selected ? parseNeeds(selected.needs) : null}
      />
    </div>
  );
}
