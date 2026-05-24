/** True when running a production deploy (Vercel or NODE_ENV). */
export function isProductionDeploy(): boolean {
  if (process.env.NODE_ENV === "production") return true;
  const vercel = process.env.VERCEL_ENV;
  return vercel === "production" || vercel === "preview";
}

export function requireSecretInProduction(
  envName: string,
  value: string | undefined,
): void {
  if (!isProductionDeploy()) return;
  if (!value || value.trim().length === 0) {
    throw new Error(
      `${envName} must be set in production. Configure it in Vercel / Convex env.`,
    );
  }
}
