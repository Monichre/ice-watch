export async function GET() {
  return Response.json(
    {
      status: "ok",
      runtime: "nextjs-convex",
      timestamp: new Date().toISOString(),
    },
    { status: 200 },
  );
}
