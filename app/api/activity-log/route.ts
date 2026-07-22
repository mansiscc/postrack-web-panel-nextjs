import { NextResponse } from "next/server";

import { getAdminUser } from "@/lib/auth/guards";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants";
import {
  parseActivityLogActionType,
  parseActivityLogStatus,
} from "@/repositories/activity-log.repository";
import { getActivityLogs } from "@/services/activity-log.service";

export async function GET(request: Request) {
  try {
    const user = await getAdminUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    const { searchParams } = new URL(request.url);

    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const rawPageSize = Number(searchParams.get("pageSize") ?? DEFAULT_PAGE_SIZE);
    const pageSize = Math.min(
      Math.max(1, Number.isFinite(rawPageSize) ? rawPageSize : DEFAULT_PAGE_SIZE),
      100,
    );

    const result = await getActivityLogs({
      page,
      pageSize,
      search: searchParams.get("search") ?? undefined,
      actionType: parseActivityLogActionType(searchParams.get("actionType")),
      moduleName: searchParams.get("moduleName") ?? undefined,
      status: parseActivityLogStatus(searchParams.get("status")),
      userId: searchParams.get("userId") ?? undefined,
      dateFrom: searchParams.get("dateFrom") ?? undefined,
      dateTo: searchParams.get("dateTo") ?? undefined,
    });

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
}
