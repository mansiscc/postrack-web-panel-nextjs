import { formatCurrency } from "@/utils/currency";

type PaymentBreakdownProps = {
  cash: number;
  upi: number;
  card: number;
};

export function PaymentBreakdown({ cash, upi, card }: PaymentBreakdownProps) {
  const total = cash + upi + card;
  const items = [
    { label: "Cash", value: cash, color: "bg-emerald-500" },
    { label: "UPI", value: upi, color: "bg-sky-500" },
    { label: "Card", value: card, color: "bg-violet-500" },
  ];

  return (
    <div className="space-y-4">
      {items.map((item) => {
        const width = total > 0 ? (item.value / total) * 100 : 0;
        return (
          <div key={item.label} className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span>{item.label}</span>
              <span className="font-medium tabular-nums">
                {formatCurrency(item.value)}
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted">
              <div
                className={`h-2 rounded-full ${item.color}`}
                style={{ width: `${width}%` }}
              />
            </div>
          </div>
        );
      })}
      {total === 0 && (
        <p className="text-sm text-muted-foreground">No payments recorded.</p>
      )}
    </div>
  );
}
