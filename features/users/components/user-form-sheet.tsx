"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, type ReactNode } from "react";
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
import { FormModalCardFooter } from "@/components/forms/form-sheet-footer";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  bindEmailInput,
  bindPhoneInput,
} from "@/lib/validation/rhf";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  ModalCard,
  ModalCardBody,
  ModalCardContent,
  ModalCardHeader,
  ModalCardTitle,
} from "@/components/ui/modal-card";
import { cn } from "@/lib/utils";

type UserFormSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: UserListItem | null;
  onSuccess: () => void;
};

function UserSectionCard({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("gap-0 py-0", className)}>
      <CardHeader className="border-b border-border/60 pb-3 pt-4">
        <CardTitle className="text-sm font-bold text-primary">{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 pt-4 pb-4">{children}</CardContent>
    </Card>
  );
}

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
    <div className="grid gap-3 sm:grid-cols-2">
      <label
        htmlFor="permissionStockIn"
        className="flex cursor-pointer items-center gap-3 rounded-lg border border-border/60 bg-surface-variant/40 px-3 py-3"
      >
        <Checkbox
          id="permissionStockIn"
          checked={stockIn}
          onCheckedChange={(checked) => onStockInChange(checked === true)}
        />
        <span className="text-[13px] font-medium">Stock In</span>
      </label>
      <label
        htmlFor="permissionStockOut"
        className="flex cursor-pointer items-center gap-3 rounded-lg border border-border/60 bg-surface-variant/40 px-3 py-3"
      >
        <Checkbox
          id="permissionStockOut"
          checked={stockOut}
          onCheckedChange={(checked) => onStockOutChange(checked === true)}
        />
        <span className="text-[13px] font-medium">Stock Out</span>
      </label>
    </div>
  );
}

function ActiveStatusField({
  checked,
  onCheckedChange,
}: {
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border/60 bg-surface-variant/40 px-3 py-3">
      <div>
        <Label htmlFor="activeStatus" className="text-[13px] font-semibold">
          Active Status
        </Label>
        <p className="text-[11px] text-muted-foreground">
          Inactive users cannot sign in
        </p>
      </div>
      <Switch
        id="activeStatus"
        checked={checked}
        onCheckedChange={onCheckedChange}
      />
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
      phone: "",
      role: "Staff",
      status: "Active",
      password: "",
      confirmPassword: "",
      permissionStockIn: false,
      permissionStockOut: false,
    },
  });

  const role = form.watch("role");
  const isActive = form.watch("status") === "Active";

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await createUserAction(values);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("User created successfully");
    onSuccess();
  });

  return (
    <form
      onSubmit={onSubmit}
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <ModalCardBody className="space-y-4">
        <div className="grid gap-4 xl:grid-cols-2 xl:items-start">
          <UserSectionCard title="Account Profile">
            <FormField
              label="Full Name"
              htmlFor="fullName"
              required
              error={form.formState.errors.fullName?.message}
            >
              <Input
                id="fullName"
                placeholder="Enter full name"
                {...form.register("fullName")}
              />
            </FormField>
            <FormField
              label="Email"
              htmlFor="email"
              required
              error={form.formState.errors.email?.message}
            >
              <Input
                id="email"
                placeholder="Enter email"
                {...bindEmailInput(form, "email")}
              />
            </FormField>
            <FormField
              label="Phone"
              htmlFor="phone"
              error={form.formState.errors.phone?.message}
            >
              <Input
                id="phone"
                {...bindPhoneInput(form, "phone", {
                  placeholder: "Enter phone number",
                })}
              />
            </FormField>
          </UserSectionCard>

          <div className="grid gap-4">
            <UserSectionCard title="Access & Role">
              <FormField label="Role">
                <Select
                  value={form.watch("role")}
                  onValueChange={(value) =>
                    form.setValue("role", value as CreateUserInput["role"])
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Admin">Admin</SelectItem>
                    <SelectItem value="Manager">Manager</SelectItem>
                    <SelectItem value="Staff">Staff</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <ActiveStatusField
                checked={isActive}
                onCheckedChange={(value) =>
                  form.setValue("status", value ? "Active" : "Inactive")
                }
              />
            </UserSectionCard>

            {role === "Staff" ? (
              <UserSectionCard title="Permissions">
                <StaffPermissions
                  stockIn={form.watch("permissionStockIn")}
                  stockOut={form.watch("permissionStockOut")}
                  onStockInChange={(value) =>
                    form.setValue("permissionStockIn", value)
                  }
                  onStockOutChange={(value) =>
                    form.setValue("permissionStockOut", value)
                  }
                />
              </UserSectionCard>
            ) : null}
          </div>
        </div>

        <UserSectionCard title="Security">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Password"
              htmlFor="password"
              required
              error={form.formState.errors.password?.message}
            >
              <Input
                id="password"
                type="password"
                placeholder="Minimum 6 characters"
                {...form.register("password")}
              />
            </FormField>
            <FormField
              label="Confirm Password"
              htmlFor="confirmPassword"
              required
              error={form.formState.errors.confirmPassword?.message}
            >
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Re-enter password"
                {...form.register("confirmPassword")}
              />
            </FormField>
          </div>
        </UserSectionCard>
      </ModalCardBody>
      <FormModalCardFooter
        onCancel={onCancel}
        isSubmitting={form.formState.isSubmitting}
        submitLabel="Save"
        submittingLabel="Saving…"
      />
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

  useEffect(() => {
    form.reset({
      fullName: user.fullName,
      phone: user.phone ?? "",
      role: user.role,
      status: user.status,
      permissionStockIn: user.permissions.includes("stock_in"),
      permissionStockOut: user.permissions.includes("stock_out"),
    });
  }, [user, form]);

  const role = form.watch("role");
  const isActive = form.watch("status") === "Active";

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await updateUserAction(user.id, values);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("User updated successfully");
    onSuccess();
  });

  return (
    <form
      onSubmit={onSubmit}
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <ModalCardBody className="space-y-4">
        <div className="grid gap-4 xl:grid-cols-2 xl:items-start">
          <UserSectionCard title="Account Profile">
            <FormField
              label="Full Name"
              htmlFor="editFullName"
              required
              error={form.formState.errors.fullName?.message}
            >
              <Input
                id="editFullName"
                placeholder="Enter full name"
                {...form.register("fullName")}
              />
            </FormField>
            <FormField label="Email" htmlFor="editEmail">
              <Input id="editEmail" value={user.email} disabled />
            </FormField>
            <FormField
              label="Phone"
              htmlFor="editPhone"
              error={form.formState.errors.phone?.message}
            >
              <Input
                id="editPhone"
                {...bindPhoneInput(form, "phone", {
                  placeholder: "Enter phone number",
                })}
              />
            </FormField>
          </UserSectionCard>

          <div className="grid gap-4">
            <UserSectionCard title="Access & Role">
              <FormField label="Role">
                <Select
                  value={form.watch("role")}
                  onValueChange={(value) =>
                    form.setValue("role", value as UpdateUserInput["role"])
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Admin">Admin</SelectItem>
                    <SelectItem value="Manager">Manager</SelectItem>
                    <SelectItem value="Staff">Staff</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <ActiveStatusField
                checked={isActive}
                onCheckedChange={(value) =>
                  form.setValue("status", value ? "Active" : "Inactive")
                }
              />
            </UserSectionCard>

            {role === "Staff" ? (
              <UserSectionCard title="Permissions">
                <StaffPermissions
                  stockIn={form.watch("permissionStockIn")}
                  stockOut={form.watch("permissionStockOut")}
                  onStockInChange={(value) =>
                    form.setValue("permissionStockIn", value)
                  }
                  onStockOutChange={(value) =>
                    form.setValue("permissionStockOut", value)
                  }
                />
              </UserSectionCard>
            ) : null}
          </div>
        </div>
      </ModalCardBody>
      <FormModalCardFooter
        onCancel={onCancel}
        isSubmitting={form.formState.isSubmitting}
        submitLabel="Update"
        submittingLabel="Saving…"
      />
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
      <ModalCardContent size="2xl">
        <ModalCardHeader>
          <ModalCardTitle>{isEdit ? "Edit User" : "Add User"}</ModalCardTitle>
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
            key={open ? "create-open" : "create-closed"}
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
