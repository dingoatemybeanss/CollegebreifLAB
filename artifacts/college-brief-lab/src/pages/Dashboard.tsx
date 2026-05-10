import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  useListBriefs,
  getListBriefsQueryKey,
  useGetBriefStats,
  getGetBriefStatsQueryKey,
} from "@workspace/api-client-react";
import { Wand2, BookOpen, TrendingUp, FileText, ArrowRight, LogIn } from "lucide-react";
import { SiGoogle } from "react-icons/si";
import type { Brief } from "@workspace/api-client-react";

const TYPE_LABELS: Record<string, string> = {
  debate: "Debate Case",
  policy: "Policy Memo",
  essay: "College Essay",
};

const TYPE_COLORS: Record<string, string> = {
  debate: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  policy: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  essay: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
};

function SignInPrompt({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-lg"
      >
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
          <FileText className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-3xl font-serif font-bold text-foreground mb-3">
          College Brief Lab
        </h1>
        <p className="text-muted-foreground text-base leading-relaxed mb-8">
          AI-powered briefs for debate cases, policy memos, and college essays.
          Build structured, compelling arguments in seconds.
        </p>
        <div className="flex flex-col items-center gap-3">
          <Button
            data-testid="button-sign-in-google"
            onClick={onSignIn}
            size="lg"
            className="gap-2 px-8"
          >
            <SiGoogle className="w-4 h-4" />
            Sign in with Google
          </Button>
          <p className="text-xs text-muted-foreground">
            Free to use. Your briefs sync across devices.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-3 gap-4 text-sm">
          {[
            { icon: Wand2, title: "AI Generation", desc: "Powered by Gemini" },
            { icon: BookOpen, title: "3 Modes", desc: "Debate / Policy / Essay" },
            { icon: TrendingUp, title: "Quality Scores", desc: "Logic & evidence rated" },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="p-4 rounded-lg bg-card border border-border text-center">
              <Icon className="w-5 h-5 text-primary mx-auto mb-2" />
              <div className="font-medium text-foreground">{title}</div>
              <div className="text-muted-foreground text-xs mt-0.5">{desc}</div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

export default function Dashboard() {
  const { user, loading, signInWithGoogle } = useAuth();
  const [, setLocation] = useLocation();

  const briefsQuery = useListBriefs(
    { firebaseUid: user?.uid ?? "" },
    {
      query: {
        enabled: !!user?.uid,
        queryKey: getListBriefsQueryKey({ firebaseUid: user?.uid ?? "" }),
      },
    }
  );

  const statsQuery = useGetBriefStats(
    { firebaseUid: user?.uid ?? "" },
    {
      query: {
        enabled: !!user?.uid,
        queryKey: getGetBriefStatsQueryKey({ firebaseUid: user?.uid ?? "" }),
      },
    }
  );

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!user) {
    return <SignInPrompt onSignIn={signInWithGoogle} />;
  }

  const stats = statsQuery.data;
  const briefs = (briefsQuery.data ?? []).slice(0, 5);
  const firstName = user.displayName?.split(" ")[0] ?? "there";

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-2xl font-serif font-bold text-foreground">
          Good to see you, {firstName}.
        </h1>
        <p className="text-muted-foreground mt-1">
          {briefs.length === 0
            ? "Build your first brief to get started."
            : "Here's your research workspace."}
        </p>
      </motion.div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {statsQuery.isLoading
          ? [1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)
          : [
              { label: "Total Briefs", value: stats?.total ?? 0, icon: FileText, color: "text-blue-500" },
              { label: "Recent (7d)", value: stats?.recentCount ?? 0, icon: TrendingUp, color: "text-emerald-500" },
              {
                label: "Most-Used Type",
                value: stats?.byType
                  ? Object.entries(stats.byType).sort(([, a], [, b]) => b - a)[0]?.[0]
                    ? TYPE_LABELS[Object.entries(stats.byType).sort(([, a], [, b]) => b - a)[0][0]] ?? "—"
                    : "—"
                  : "—",
                icon: BookOpen,
                color: "text-violet-500",
              },
            ].map(({ label, value, icon: Icon, color }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
              >
                <Card data-testid={`card-stat-${label.toLowerCase().replace(/ /g, "-")}`}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">{label}</p>
                        <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
                      </div>
                      <div className={`p-2 rounded-lg bg-muted ${color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
      </div>

      {/* Quick action */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="mb-8"
      >
        <Button
          data-testid="button-build-brief"
          size="lg"
          className="gap-2"
          onClick={() => setLocation("/builder")}
        >
          <Wand2 className="w-4 h-4" />
          Build a Brief
          <ArrowRight className="w-4 h-4" />
        </Button>
      </motion.div>

      {/* Recent briefs */}
      {briefs.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-foreground">Recent Briefs</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/history")}
              data-testid="link-view-all-briefs"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              View all
              <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
          <div className="space-y-2">
            {briefsQuery.isLoading
              ? [1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)
              : briefs.map((brief: Brief, i: number) => (
                  <motion.div
                    key={brief.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06 }}
                  >
                    <Card
                      data-testid={`card-brief-${brief.id}`}
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => setLocation("/history")}
                    >
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[brief.briefType] ?? ""}`}>
                              {TYPE_LABELS[brief.briefType] ?? brief.briefType}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-foreground truncate">{brief.title}</p>
                          {brief.summary && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">{brief.summary}</p>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground flex-shrink-0">
                          {new Date(brief.createdAt).toLocaleDateString()}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
          </div>
        </div>
      )}

      {briefs.length === 0 && !briefsQuery.isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center py-16 text-muted-foreground"
        >
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No briefs yet. Build your first one above.</p>
        </motion.div>
      )}
    </div>
  );
}
