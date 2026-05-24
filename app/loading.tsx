export default function Loading() {
  return (
    <main
      className="mx-auto max-w-7xl px-4 py-12 sm:px-8"
      style={{ background: "#0a0a0a", color: "#ededed", minHeight: "60vh" }}
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#7a7a7a]">
        › LOADING
      </p>
      <div className="mt-6 h-8 w-48 animate-pulse bg-[#1c1c1c]" />
      <div className="mt-4 h-4 w-full max-w-md animate-pulse bg-[#161616]" />
    </main>
  );
}
