import { lazy, Suspense, useState } from "react";
import { Receipt } from "lucide-react";
import { getCurrentUser } from "@/lib/auth-client";
import { Button } from "./ui/button";

const Workspace = lazy(async () => ({
  default: (await import("./cv-transactions-workspace")).CvTransactionsWorkspace,
}));
export function CvTransactionsLauncher() {
  const [open, setOpen] = useState(false);
  if (getCurrentUser()?.role !== "admin") return null;
  return (
    <>
      <Button
        size="sm"
        className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md hover:from-emerald-500 hover:to-teal-500"
        onClick={() => setOpen(true)}
      >
        <Receipt className="mr-2 h-4 w-4" />
        Transactions
      </Button>
      {open && (
        <Suspense fallback={<p role="status">Chargement des transactions…</p>}>
          <Workspace onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </>
  );
}
