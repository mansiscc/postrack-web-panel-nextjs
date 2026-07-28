import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatCurrency, formatNumber } from "@/utils/currency";

type TopRankedRow = {
  id: string;
  name: string;
  primary: string | number;
  secondary?: string | number;
};

type TopRankedTableProps = {
  title: string;
  primaryHeader: string;
  secondaryHeader: string;
  rows: TopRankedRow[];
  formatPrimary?: (value: string | number) => string;
  formatSecondary?: (value: string | number) => string;
};

const RANK_STYLES = [
  "bg-rank-1",
  "bg-rank-2 text-rank-2-foreground",
  "bg-rank-3",
];

export function TopRankedTable({
  title,
  primaryHeader,
  secondaryHeader,
  rows,
  formatPrimary = (value) =>
    typeof value === "number" ? formatCurrency(value) : String(value),
  formatSecondary = (value) =>
    typeof value === "number" ? formatNumber(value) : String(value),
}: TopRankedTableProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No data for this period.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="text-left">{primaryHeader}</TableHead>
              <TableHead className="text-left">{secondaryHeader}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => (
              <TableRow
                key={row.id}
                className={cn(index < 3 && RANK_STYLES[index])}
              >
                <TableCell className="font-medium">{index + 1}</TableCell>
                <TableCell>{row.name}</TableCell>
                <TableCell className="tabular-nums">
                  {formatPrimary(row.primary)}
                </TableCell>
                <TableCell className="tabular-nums">
                  {row.secondary !== undefined
                    ? formatSecondary(row.secondary)
                    : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
