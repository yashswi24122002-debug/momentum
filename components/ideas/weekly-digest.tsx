import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WeeklyDigest } from "@/lib/ideas/digest";

export function WeeklyDigestCard({ digest }: { digest: WeeklyDigest }) {
  return (
    <Card className="border-border bg-surface">
      <CardHeader>
        <CardTitle className="text-sm text-text-secondary">This week</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-xl font-semibold text-text-primary">{digest.generated}</p>
            <p className="text-xs text-text-muted">Generated</p>
          </div>
          <div>
            <p className="text-xl font-semibold text-primary">{digest.approved}</p>
            <p className="text-xs text-text-muted">Approved</p>
          </div>
          <div>
            <p className="text-xl font-semibold text-danger">{digest.rejected}</p>
            <p className="text-xs text-text-muted">Rejected</p>
          </div>
        </div>
        {digest.staleBacklog.length > 0 && (
          <div className="space-y-1 border-t border-border pt-3">
            <p className="text-xs font-medium text-warning">
              {digest.staleBacklog.length} idea{digest.staleBacklog.length === 1 ? "" : "s"} untouched 7+ days
            </p>
            {digest.staleBacklog.map((item) => (
              <Link
                key={item.reportId}
                href={`/ideas/${item.ideaId}`}
                className="block text-xs text-text-secondary hover:text-primary"
              >
                {item.daysUntouched} days — view idea
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
