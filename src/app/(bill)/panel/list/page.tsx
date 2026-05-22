import Link from "next/link";
import ListClient from "./ListClient";

export default function BillListPage() {
  return (
    <div className="max-w-md mx-auto px-4 py-6">
      <header className="flex items-center justify-between mb-6">
        <Link href="/list" className="text-lg font-serif font-semibold">Bobo&apos;s Bill</Link>
      </header>
      <ListClient />
    </div>
  );
}
