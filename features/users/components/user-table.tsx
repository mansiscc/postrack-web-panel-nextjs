"use client";

import type { ColumnDef } from "@tanstack/react-table";
import {
  KeyRound,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  UserCog,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import { useTableRefresh } from "@/hooks/use-table-refresh";
import { toast } from "sonner";

import {
  deleteUserAction,
  restoreUserAction,
} from "@/features/users/actions";
import { ChangePasswordDialog } from "@/features/users/components/change-password-dialog";
import { UserFormSheet } from "@/features/users/components/user-form-sheet";
import type { UserListItem } from "@/features/users/types";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { DataTableToolbar } from "@/components/data-table/toolbar";
import { EmptyState } from "@/components/feedback/empty-state";
import { StatusBadge } from "@/components/forms/status-badge";
import { SearchInput } from "@/components/forms/search-input";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type UserTableProps = {
  users: UserListItem[];
  currentUserId: string;
};

export function UserTable({ users, currentUserId }: UserTableProps) {
  const refresh = useTableRefresh();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<UserListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserListItem | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<UserListItem | null>(null);
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    return users.filter((item) => {
      const matchesDeleted = includeDeleted || !item.isDeleted;
      const matchesSearch =
        item.fullName.toLowerCase().includes(search.toLowerCase()) ||
        item.email.toLowerCase().includes(search.toLowerCase());
      const matchesRole = role === "all" || item.role === role;
      const matchesStatus = status === "all" || item.status === status;
      return matchesDeleted && matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, search, role, status, includeDeleted]);

  const handleDelete = () => {
    if (!deleteTarget) return;
    startTransition(async () => {
      const result = await deleteUserAction(deleteTarget.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("User deleted");
      setDeleteTarget(null);
      refresh();
    });
  };

  const handleRestore = (user: UserListItem) => {
    startTransition(async () => {
      const result = await restoreUserAction(user.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("User restored");
      refresh();
    });
  };

  const columns = useMemo<ColumnDef<UserListItem>[]>(
    () => [
      {
        accessorKey: "fullName",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Name" />
        ),
        cell: ({ row }) => (
          <span className="font-medium">{row.original.fullName}</span>
        ),
      },
      { accessorKey: "email", header: "Email" },
      {
        accessorKey: "role",
        header: "Role",
        cell: ({ row }) => (
          <Badge variant="secondary">{row.original.role}</Badge>
        ),
      },
      {
        id: "permissions",
        header: "Permissions",
        cell: ({ row }) =>
          row.original.role === "Staff" ? (
            <div className="flex flex-wrap gap-1">
              {row.original.permissions.map((permission) => (
                <Badge key={permission} variant="outline">
                  {permission.replace("_", " ")}
                </Badge>
              ))}
            </div>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <StatusBadge
            status={
              row.original.isDeleted
                ? "deleted"
                : row.original.status === "Active"
                  ? "active"
                  : "inactive"
            }
            label={
              row.original.isDeleted
                ? "Deleted"
                : row.original.status
            }
          />
        ),
      },
      {
        id: "actions",
        cell: ({ row }) => {
          const user = row.original;
          const isSelf = user.id === currentUserId;

          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="icon-sm">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {!user.isDeleted ? (
                  <>
                    <DropdownMenuItem
                      onClick={() => {
                        setEditing(user);
                        setSheetOpen(true);
                      }}
                    >
                      <Pencil />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setPasswordTarget(user)}>
                      <KeyRound />
                      Change password
                    </DropdownMenuItem>
                    {!isSelf ? (
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setDeleteTarget(user)}
                      >
                        <Trash2 />
                        Delete
                      </DropdownMenuItem>
                    ) : null}
                  </>
                ) : (
                  <DropdownMenuItem onClick={() => handleRestore(user)}>
                    <RotateCcw />
                    Restore
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [currentUserId],
  );

  return (
    <>
      <DataTableToolbar
        actions={
          <Button
            type="button"
            onClick={() => {
              setEditing(null);
              setSheetOpen(true);
            }}
          >
            <Plus />
            Add user
          </Button>
        }
      >
        <SearchInput value={search} onChange={setSearch} placeholder="Search users…" />
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger className="h-10 w-32.5">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            <SelectItem value="Admin">Admin</SelectItem>
            <SelectItem value="Manager">Manager</SelectItem>
            <SelectItem value="Staff">Staff</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-10 w-32.5">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Checkbox
            id="includeDeleted"
            checked={includeDeleted}
            onCheckedChange={(checked) => setIncludeDeleted(checked === true)}
          />
          <Label htmlFor="includeDeleted">Show deleted</Label>
        </div>
      </DataTableToolbar>

      {filtered.length === 0 ? (
        <EmptyState
          icon={UserCog}
          title="No users found"
          description="Add team members to your store."
          action={
            <Button
              type="button"
              onClick={() => {
                setEditing(null);
                setSheetOpen(true);
              }}
            >
              <Plus />
              Add user
            </Button>
          }
        />
      ) : (
        <DataTable columns={columns} data={filtered} />
      )}

      <UserFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        user={editing}
        onSuccess={refresh}
      />

      <ChangePasswordDialog
        open={Boolean(passwordTarget)}
        onOpenChange={(open) => !open && setPasswordTarget(null)}
        userId={passwordTarget?.id ?? null}
        userName={passwordTarget?.fullName}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete user?"
        description={`Delete ${deleteTarget?.fullName}? Users with business references are soft-deleted and can be restored.`}
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
      />
    </>
  );
}
