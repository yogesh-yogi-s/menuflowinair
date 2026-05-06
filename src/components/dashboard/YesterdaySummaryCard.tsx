import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { getLatestSummary } from "@/services/summaries";
import { supabase } from "@/integrations/supabase/client";

export function YesterdaySummaryCard() {
  const [generating, setGenerating] = useState(false);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["daily_summary", "latest"],
    queryFn: getLatestSummary,
  });

  const generate = async () => {
    setGenerating(true);
    try {
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (!token) {
        toast.error("Please sign in again");
        return;
      }
      const res = await fetch("/api/ai/generate-summary-now", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const j = await res.json();
      if (!res.ok) {
        toast.error(j.error || "Failed to generate summary");
        return;
      }
      toast.success("Summary updated");
      refetch();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              Yesterday's AI summary
            </CardTitle>
            <CardDescription>
              Auto-generated daily at 8:00 AM in your local time.
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={generate}
            disabled={generating}
          >
            {generating ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-3.5 w-3.5" />
            )}
            Generate now
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : !data ? (
          <p className="text-sm text-muted-foreground">
            No summary yet. Click "Generate now" to create one for yesterday.
          </p>
        ) : (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">
              {new Date(data.summary_date).toLocaleDateString(undefined, {
                weekday: "long",
                month: "short",
                day: "numeric",
              })}
            </div>
            <p className="text-sm whitespace-pre-line">
              {data.ai_text || "No AI text available."}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}