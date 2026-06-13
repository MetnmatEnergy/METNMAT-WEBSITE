import { FileText } from "lucide-react";
import { Button } from "@/frontend/components/ui/button";
import { getCurrentCustomer, getCustomerEnquiries } from "@/backend/lib/customer";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  new: "text-amber-600 bg-amber-500/10",
  quoted: "text-indigo-600 bg-indigo-500/10",
  accepted: "text-emerald-600 bg-emerald-500/10",
  closed: "text-muted-foreground bg-muted",
};

export default async function RfqPage() {
  const customer = await getCurrentCustomer();
  const rfqs = await getCustomerEnquiries(customer?.email);

  if (rfqs.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-12 text-center">
        <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
        <h2 className="mt-4 font-display text-lg font-semibold">No quote requests yet</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Submit a request and track its status (New → Quoted → Accepted) here.
        </p>
        <Button href="/quote" className="mt-5">Request a quote</Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rfqs.map((r, i) => {
        const date = r.createdAt
          ? new Date(r.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
          : "—";
        const status = (r.status || "new").toLowerCase();
        return (
          <div key={r.id || i} className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="font-display font-semibold">{r.productName || "General enquiry"}</span>
                <p className="mt-1 text-sm text-muted-foreground">{date}</p>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLE[status] || "bg-muted text-muted-foreground"}`}>
                {status}
              </span>
            </div>
            {r.message && (
              <p className="mt-3 line-clamp-2 border-t border-border pt-3 text-sm text-muted-foreground">{r.message}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
