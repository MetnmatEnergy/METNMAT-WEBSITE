import { FileText } from "lucide-react";
import { Button } from "@/frontend/components/ui/button";

export default function RfqPage() {
  // TODO(feature): list the user's submitted RFQs / quotes from the API.
  return (
    <div className="rounded-2xl border border-border bg-surface p-12 text-center">
      <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
      <h2 className="mt-4 font-display text-lg font-semibold">No quote requests yet</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Submit a request and track its status (Submitted → Quoted → Accepted) here.
      </p>
      <Button href="/quote" className="mt-5">Request a quote</Button>
    </div>
  );
}
