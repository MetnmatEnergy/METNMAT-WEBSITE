import { Plus } from "lucide-react";
import { Card } from "@/frontend/components/ui/card";
import { Button } from "@/frontend/components/ui/button";

export default function AddressesPage() {
  // TODO(feature): real saved addresses (CRUD) from the API.
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Card className="flex min-h-[160px] flex-col items-center justify-center border-dashed text-center">
        <Plus className="h-6 w-6 text-muted-foreground" />
        <Button type="button" variant="ghost" className="mt-2">Add a new address</Button>
      </Card>
    </div>
  );
}
