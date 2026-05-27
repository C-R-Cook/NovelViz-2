import { requireAdminApi } from "@/lib/admin-auth";
import {
  COVER_AI_SETTINGS_ID,
  defaultCoverAiModelsJson,
  defaultCoverAiPromptPrefixes,
  getCoverAiAdminSettings,
  parseCoverAiModelsJson,
} from "@/lib/cover-ai-settings";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const admin = await requireAdminApi();
  if (!admin.ok) return admin.response;
  const settings = await getCoverAiAdminSettings();
  return NextResponse.json(settings);
}

export async function PATCH(request: Request) {
  const admin = await requireAdminApi();
  if (!admin.ok) return admin.response;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const prompts = defaultCoverAiPromptPrefixes();
  const defaultsModels = defaultCoverAiModelsJson();

  const patch: {
    basePromptPrefix?: string;
    titlePromptTemplate?: string;
    authorPromptTemplate?: string;
    modelsJson?: any;
  } = {};

  if ("basePromptPrefix" in body) {
    const v = body.basePromptPrefix;
    if (typeof v !== "string" || v.trim().length === 0) {
      return NextResponse.json({ error: "basePromptPrefix must be a non-empty string" }, { status: 400 });
    }
    patch.basePromptPrefix = v;
  }
  if ("titlePromptTemplate" in body) {
    const v = body.titlePromptTemplate;
    if (typeof v !== "string" || !v.includes("{{title}}")) {
      return NextResponse.json(
        { error: "titlePromptTemplate must include {{title}}" },
        { status: 400 },
      );
    }
    patch.titlePromptTemplate = v;
  }
  if ("authorPromptTemplate" in body) {
    const v = body.authorPromptTemplate;
    if (typeof v !== "string" || !v.includes("{{author}}")) {
      return NextResponse.json(
        { error: "authorPromptTemplate must include {{author}}" },
        { status: 400 },
      );
    }
    patch.authorPromptTemplate = v;
  }
  let modelsValidated: any = undefined;
  if ("modelsJson" in body) {
    try {
      modelsValidated = parseCoverAiModelsJson(body.modelsJson);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Invalid modelsJson" },
        { status: 400 },
      );
    }
    patch.modelsJson = modelsValidated;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      {
        error:
          "Provide at least one of: basePromptPrefix, titlePromptTemplate, authorPromptTemplate, modelsJson",
      },
      { status: 400 },
    );
  }

  await prisma.coverAiAdminSettings.upsert({
    where: { id: COVER_AI_SETTINGS_ID },
    create: {
      id: COVER_AI_SETTINGS_ID,
      basePromptPrefix: (patch.basePromptPrefix ?? prompts.basePromptPrefix).trim(),
      titlePromptTemplate: patch.titlePromptTemplate ?? prompts.titlePromptTemplate,
      authorPromptTemplate: patch.authorPromptTemplate ?? prompts.authorPromptTemplate,
      modelsJson: modelsValidated ?? defaultsModels,
    },
    update: {
      ...(patch.basePromptPrefix !== undefined ? { basePromptPrefix: patch.basePromptPrefix } : {}),
      ...(patch.titlePromptTemplate !== undefined
        ? { titlePromptTemplate: patch.titlePromptTemplate }
        : {}),
      ...(patch.authorPromptTemplate !== undefined
        ? { authorPromptTemplate: patch.authorPromptTemplate }
        : {}),
      ...(modelsValidated !== undefined ? { modelsJson: modelsValidated as any } : {}),
    },
  });

  const saved = await getCoverAiAdminSettings();
  return NextResponse.json(saved);
}
