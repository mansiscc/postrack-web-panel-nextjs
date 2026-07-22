"use server";

import { revalidatePath } from "next/cache";

import {
  changePasswordSchema,
  createUserSchema,
  updateUserSchema,
} from "@/features/users/schema";
import { requireAdmin } from "@/lib/auth/guards";
import {
  changeUserPassword,
  createUserRecord,
  deleteUserRecord,
  restoreUserRecordService,
  updateUserRecordService,
} from "@/services/user.service";
import { actionError, actionSuccess, type ActionResult } from "@/utils/action-result";
import { getErrorMessage } from "@/utils/errors";

export async function createUserAction(
  input: unknown,
): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const parsed = createUserSchema.safeParse(input);
    if (!parsed.success) {
      return actionError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    await createUserRecord(user, parsed.data);
    revalidatePath("/users");
    return actionSuccess(undefined);
  } catch (error) {
    return actionError(getErrorMessage(error));
  }
}

export async function updateUserAction(
  userId: string,
  input: unknown,
): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const parsed = updateUserSchema.safeParse(input);
    if (!parsed.success) {
      return actionError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    await updateUserRecordService(user, userId, parsed.data);
    revalidatePath("/users");
    return actionSuccess(undefined);
  } catch (error) {
    return actionError(getErrorMessage(error));
  }
}

export async function deleteUserAction(userId: string): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    await deleteUserRecord(user, userId);
    revalidatePath("/users");
    return actionSuccess(undefined);
  } catch (error) {
    return actionError(getErrorMessage(error));
  }
}

export async function restoreUserAction(userId: string): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    await restoreUserRecordService(user, userId);
    revalidatePath("/users");
    return actionSuccess(undefined);
  } catch (error) {
    return actionError(getErrorMessage(error));
  }
}

export async function changeUserPasswordAction(
  input: unknown,
): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const parsed = changePasswordSchema.safeParse(input);
    if (!parsed.success) {
      return actionError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    await changeUserPassword(
      user,
      parsed.data.userId,
      parsed.data.newPassword,
    );
    return actionSuccess(undefined);
  } catch (error) {
    return actionError(getErrorMessage(error));
  }
}
