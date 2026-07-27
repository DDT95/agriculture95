import Link from "next/link";

export function ToolHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="tool-header">
      <Link className="tool-logo" href="/" aria-label="Retour à l’Atlas territorial">
        <img src="/prefet-val-doise-logo.png" alt="Préfet du Val-d’Oise" />
      </Link>
      <div className="tool-title"><span>{subtitle}</span><strong>{title}</strong></div>
      <nav><Link href="/">← Atlas</Link><Link href="/urbanisme">Urbanisme</Link><Link href="/agriculture">Agriculture</Link><Link href="/risques">Risques</Link><Link href="/habitat">Habitat</Link></nav>
    </header>
  );
}
