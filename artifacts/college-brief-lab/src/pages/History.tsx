import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  useListBriefs,
  getListBriefsQueryKey,
  useDeleteBrief,
  getGetBriefStatsQueryKey,
} from "@workspace/api-client-react";
import type { Brief } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Trash2, FileText, BookOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const TYPE_LABELS: Record<string, string> = {
  debate: "Debate Case",
  policy: "Policy Memo",
  essay: "College Essay",
};

const TYPE_COLORS: Record<string, string> = {
  debate: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  policy: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
  essay: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
};

function ScoreBars({ scoreStr }: { scoreStr: string | null | undefined }) {
  if (!scoreStr) return null;
  let score: Record<string, number>;
  try {
    score = JSON.parse(scoreStr);
  } catch {
    return null;
  }
  const keys = ["logic", "evidence", "clarity", "originality"];
  return (
    <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
      {keys.map((k) => {
        const val = score[k] ?? 0;
        return (
          <div key={k}>
            <div className="flex justify-between text-xs text-muted-foreground mb-0.5">
              <span className="capitalize">{k}</span>
              <span>{val}/10</span>
            </div>
            <div className="h-1 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${(val / 10) * 100}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SectionList({ sectionsStr }: { sectionsStr: string | null | undefined }) {
  const [open, setOpen] = useState(false);
  if (!sectionsStr) return null;
  let sections: { heading: string; bullets: string[] }[];
  try {
    sections = JSON.parse(sectionsStr);
  } catch {
    return null;
  }
  if (!sections.length) return null;

  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen(!open)}
        className="text-xs text-primary hover:underline"
        data-testid="button-toggle-sections"
      >
        {open ? "Hide sections" : `View ${sections.length} sections`}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-2 space-y-2 overflow-hidden"
          >
            {sections.map((sec, i) => (
              <div key={i} className="p-3 rounded-lg bg-muted/50">
                <div className="text-xs font-semibold text-foreground mb-1">{sec.heading}</div>
                <ul className="space-y-0.5">
                  {sec.bullets.map((b, j) => (
                    <li key={j} className="text-xs text-muted-foreground flex gap-1.5">
                      <span className="text-primary mt-0.5">•</span>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function History() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const briefsQuery = useListBriefs(
    { firebaseUid: user?.uid ?? "" },
    {
      query: {
        enabled: !!user?.uid,
        queryKey: getListBriefsQueryKey({ firebaseUid: user?.uid ?? "" }),
      },
    }
  );

  const deleteMutation = useDeleteBrief({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListBriefsQueryKey({ firebaseUid: user?.uid ?? "" }) });
        queryClient.invalidateQueries({ queryKey: getGetBriefStatsQueryKey({ firebaseUid: user?.uid ?? "" }) });
        toast({ title: "Brief deleted" });
        setDeleteId(null);
      },
      onError: () => {
        toast({ title: "Failed to delete brief", variant: "destructive" });
      },
    },
  });

  const allBriefs: Brief[] = briefsQuery.data ?? [];
  const filtered = allBriefs.filter((b) => {
    const matchesType = typeFilter === "all" || b.briefType === typeFilter;
    const matchesSearch =
      !search ||
      b.title.toLowerCase().includes(search.toLowerCase()) ||
      (b.summary ?? "").toLowerCase().includes(search.toLowerCase());
    return matchesType && matchesSearch;
  });

  if (!user) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p>Sign in to view your brief history.</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-serif font-bold text-foreground">Brief History</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {allBriefs.length} brief{allBriefs.length !== 1 ? "s" : ""} saved
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            data-testid="input-search-briefs"
            placeholder="Search briefs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          {["all", "debate", "policy", "essay"].map((t) => (
            <Button
              key={t}
              data-testid={`button-filter-${t}`}
              variant={typeFilter === t ? "default" : "outline"}
              size="sm"
              onClick={() => setTypeFilter(t)}
              className="capitalize text-xs"
            >
              {t === "all" ? "All" : TYPE_LABELS[t]}
            </Button>
          ))}
        </div>
      </div>

      {/* List */}
      {briefsQuery.isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">{allBriefs.length === 0 ? "No briefs yet." : "No briefs match your search."}</p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((brief, i) => (
              <motion.div
                key={brief.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ delay: i * 0.04 }}
              >
                <Card data-testid={`card-brief-${brief.id}`}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <Badge
                            variant="outline"
                            className={`text-xs font-medium ${TYPE_COLORS[brief.briefType] ?? ""}`}
                          >
                            {TYPE_LABELS[brief.briefType] ?? brief.briefType}
                          </Badge>
                          {brief.tone && (
                            <Badge variant="outline" className="text-xs capitalize">
                              {brief.tone}
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground ml-auto">
                            {new Date(brief.createdAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                        <h3 className="text-sm font-semibold text-foreground">{brief.title}</h3>
                        {brief.summary && (
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">
                            {brief.summary}
                          </p>
                        )}
                        <ScoreBars scoreStr={brief.score} />
                        <SectionList sectionsStr={brief.sections} />
                      </div>
                      <Button
                        data-testid={`button-delete-brief-${brief.id}`}
                        variant="ghost"
                        size="icon"
                        className="flex-shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteId(brief.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Delete confirm dialog */}
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this brief?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. The brief will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-confirm-delete"
              onClick={() => deleteId !== null && deleteMutation.mutate({ id: deleteId })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
