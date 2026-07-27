"use client";

import type { ActiveStatusFilter } from "@/types/list-params";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type StatusFilterSelectProps = {
  value: ActiveStatusFilter;
  onValueChange: (value: ActiveStatusFilter) => void;
  className?: string;
};

export function StatusFilterSelect({
  value,
  onValueChange,
  className = "w-36",
}: StatusFilterSelectProps) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={`h-9.5 ${className}`}>
        <SelectValue placeholder="Status" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All status</SelectItem>
        <SelectItem value="active">Active</SelectItem>
        <SelectItem value="inactive">Inactive</SelectItem>
      </SelectContent>
    </Select>
  );
}
