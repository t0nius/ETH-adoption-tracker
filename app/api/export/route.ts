import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { isProductionDeploy, requireSecretInProduction } from "@/lib/production";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  const requiredToken = process.env.EXPORT_API_TOKEN;
  try {
    requireSecretInProduction("EXPORT_API_TOKEN", requiredToken);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 503 },
    );
  }
  if (requiredToken) {
    const requestUrl = new URL(req.url);
    const provided =
      req.headers.get("x-export-token") ?? requestUrl.searchParams.get("token");
    if (provided !== requiredToken) {
      return Response.json({ error: "Unauthorized export request" }, { status: 401 });
    }
  }
  if (!url) {
    return Response.json(
      { error: "NEXT_PUBLIC_CONVEX_URL not configured" },
      { status: 500 },
    );
  }
  try {
    const client = new ConvexHttpClient(url);
    const [snapshots, triggers] = await Promise.all([
      client.query(api.snapshots.latestPerMetric, {}),
      client.query(api.triggers.listTriggers, {}),
    ]);
    return Response.json(
      {
        exported_at: new Date().toISOString(),
        snapshots,
        triggers,
      },
      {
        headers: {
          "Content-Disposition": `attachment; filename="eth-tracker-${new Date().toISOString().slice(0, 10)}.json"`,
        },
      },
    );
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
