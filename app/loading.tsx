export default function Loading() {
  return (
    <main
      className="mx-auto max-w-7xl px-4 py-8 sm:px-8"
      style={{ background: "#0a0a0a", color: "#ededed", minHeight: "60vh" }}
    >
      <p className="text-eyebrow">› LOADING</p>
      <div className="mt-6 skeleton h-8 w-48 rounded-none" />
      <div className="mt-4 skeleton h-4 w-full max-w-md rounded-none" />
      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="surface p-4">
            <div className="skeleton h-3 w-16 rounded-none" />
            <div className="mt-3 skeleton h-6 w-24 rounded-none" />
            <div className="mt-4 skeleton h-10 w-full rounded-none" />
          </div>
        ))}
      </div>
    </main>
  );
}
