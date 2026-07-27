"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import {
  createUserAction,
  updateUserAction,
} from "@/features/users/actions";
import {
  createUserSchema,
  updateUserSchema,
  type CreateUserInput,
  type UpdateUserInput,
} from "@/features/users/schema";
import type { UserListItem } from "@/features/users/types";
import { FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ModalCard,
  ModalCardBody,
  ModalCardContent,
  ModalCardFooter,
  ModalCardHeader,
  ModalCardTitle,
} from "@/components/ui/modal-card";

type UserFormSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: UserListItem | null;
  onSuccess: () => void;
};

function StaffPermissions({
  stockIn,
  stockOut,
  onStockInChange,
  onStockOutChange,
}: {
  stockIn: boolean;
  stockOut: boolean;
  onStockInChange: (value: boolean) => void;
  onStockOutChange: (value: boolean) => void;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
      <p className="text-sm font-medium">Staff permissions</p>
      <div className="flex items-center gap-2">
        <Checkbox
          id="stockIn"
          checked={stockIn}
          onCheckedChange={(checked) => onStockInChange(checked === true)}
        />
        <Label htmlFor="stockIn">Stock-in</Label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="stockOut"
          checked={stockOut}
          onCheckedChange={(checked) => onStockOutChange(checked === true)}
        />
        <Label htmlFor="stockOut">Stock-out</Label>
      </div>
    </div>
  );
}

function CreateUserForm({
  onCancel,
  onSuccess,
}: {
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const form = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      phone: "",
      role: "Staff",
      status: "Active",
      permissionStockIn: true,
      permissionStockOut: false,
    },
  });

  const role = form.watch("role");

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await createUserAction(values);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("User created");
    onSuccess();
  });

  return (
    <form
      onSubmit={onSubmit}
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <ModalCardBody className="space-y-4">
        <FormField label="Full name" required error={form.formState.errors.fullName?.message}>
          <Input {...form.register("fullName")} />
        </FormField>
        <FormField label="Email" required error={form.formState.errors.email?.message}>
          <Input type="email" {...form.register("email")} />
        </FormField>
        <FormField label="Password" required error={form.formState.errors.password?.message}>
          <Input type="password" {...form.register("password")} />
        </FormField>
        <FormField label="Phone" error={form.formState.errors.phone?.message}>
          <Input {...form.register("phone")} />
        </FormField>
        <FormField label="Role">
          <Select
            value={form.watch("role")}
            onValueChange={(value) =>
              form.setValue("role", value as CreateUserInput["role"])
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Admin">Admin</SelectItem>
              <SelectItem value="Manager">Manager</SelectItem>
              <SelectItem value="Staff">Staff</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Status">
          <Select
            value={form.watch("status")}
            onValueChange={(value) =>
              form.setValue("status", value as CreateUserInput["status"])
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
        {role === "Staff" ? (
          <StaffPermissions
            stockIn={form.watch("permissionStockIn")}
            stockOut={form.watch("permissionStockOut")}
            onStockInChange={(value) => form.setValue("permissionStockIn", value)}
            onStockOutChange={(value) => form.setValue("permissionStockOut", value)}
          />
        ) : null}
      </ModalCardBody>
      <ModalCardFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? (
            <>
              <Loader2 className="animate-spin" />
              Saving…
            </>
          ) : (
            "Save"
          )}
        </Button>
      </ModalCardFooter>
    </form>
  );
}

function EditUserForm({
  user,
  onCancel,
  onSuccess,
}: {
  user: UserListItem;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const form = useForm<UpdateUserInput>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: {
      fullName: user.fullName,
      phone: user.phone ?? "",
      role: user.role,
      status: user.status,
      permissionStockIn: user.permissions.includes("stock_in"),
      permissionStockOut: user.permissions.includes("stock_out"),
    },
  });

  const role = form.watch("role");

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await updateUserAction(user.id, values);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("User updated");
    onSuccess();
  });

  return (
    <form
      onSubmit={onSubmit}
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <ModalCardBody className="space-y-4">
        <FormField label="Full name" required error={form.formState.errors.fullName?.message}>
          <Input {...form.register("fullName")} />
        </FormField>
        <FormField label="Email">
          <Input value={user.email} disabled />
        </FormField>
        <FormField label="Phone" error={form.formState.errors.phone?.message}>
          <Input {...form.register("phone")} />
        </FormField>
        <FormField label="Role">
          <Select
            value={form.watch("role")}
            onValueChange={(value) =>
              form.setValue("role", value as UpdateUserInput["role"])
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Admin">Admin</SelectItem>
              <SelectItem value="Manager">Manager</SelectItem>
              <SelectItem value="Staff">Staff</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Status">
          <Select
            value={form.watch("status")}
            onValueChange={(value) =>
              form.setValue("status", value as UpdateUserInput["status"])
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
        {role === "Staff" ? (
          <StaffPermissions
            stockIn={form.watch("permissionStockIn")}
            stockOut={form.watch("permissionStockOut")}
            onStockInChange={(value) => form.setValue("permissionStockIn", value)}
            onStockOutChange={(value) => form.setValue("permissionStockOut", value)}
          />
        ) : null}
      </ModalCardBody>
      <ModalCardFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Saving…" : "Save"}
        </Button>
      </ModalCardFooter>
    </form>
  );
}

export function UserFormSheet({
  open,
  onOpenChange,
  user,
  onSuccess,
}: UserFormSheetProps) {
  const isEdit = Boolean(user);

  return (
    <ModalCard open={open} onOpenChange={onOpenChange}>
      <ModalCardContent size="lg">
        <ModalCardHeader>
          <ModalCardTitle>{isEdit ? "Edit user" : "Add user"}</ModalCardTitle>
        </ModalCardHeader>
        {isEdit && user ? (
          <EditUserForm
            key={user.id}
            user={user}
            onCancel={() => onOpenChange(false)}
            onSuccess={() => {
              onOpenChange(false);
              onSuccess();
            }}
          />
        ) : (
          <CreateUserForm
            onCancel={() => onOpenChange(false)}
            onSuccess={() => {
              onOpenChange(false);
              onSuccess();
            }}
          />
        )}
      </ModalCardContent>
    </ModalCard>
  );
}
