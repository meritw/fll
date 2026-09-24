export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || !process.env.DATABASE_URL) {
    return;
  }

  const { bootstrap } = await import("@/lib/bootstrap");
  try {
    await bootstrap();
  } catch (error) {
    console.error("Startup setup failed.", error);
  }
}
