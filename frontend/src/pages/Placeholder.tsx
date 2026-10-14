// temporary page until the real one is built
export default function Placeholder({ title, phase }: { title: string; phase: number }) {
  return (
    <div className="container-page py-16 text-center">
      <h1 className="text-3xl font-semibold text-forest">{title}</h1>
      <p className="mt-2 text-sm text-muted">Coming in phase {phase}.</p>
    </div>
  );
}
