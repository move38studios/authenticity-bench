import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod/v4";

export type Session = Awaited<ReturnType<typeof auth.api.getSession>>;

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function notFound(resource = "Resource") {
  return NextResponse.json(
    { error: `${resource} not found` },
    { status: 404 }
  );
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

export async function parseBody<T extends z.ZodType>(
  request: Request,
  schema: T
): Promise<
  | { success: true; data: z.infer<T> }
  | { success: false; response: NextResponse }
> {
  try {
    const body = await request.json();
    const result = schema.safeParse(body);
    if (!result.success) {
      return {
        success: false,
        response: badRequest(z.prettifyError(result.error)),
      };
    }
    return { success: true, data: result.data };
  } catch {
    return { success: false, response: badRequest("Invalid JSON body") };
  }
}
