import { useState } from "react";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import NavBar, { type View } from "@/components/NavBar";
import Dashboard from "@/pages/Dashboard";
import BriefBuilder from "@/pages/BriefBuilder";
import OpportunityPlanner from "@/pages/OpportunityPlanner";

type BuilderPayload = { prompt?: string; linkedOpportunityId?: string };

function AppShell() {
  const { user, loading, signInGoogle } = useAuth();
  const [view, setView] = useState<View>("dashboard");
  const [builderPayload, setBuilderPayload] = useState<BuilderPayload>({});

  function handleNav(v: View, payload?: unknown) {
    setView(v);
    if (v === "builder" && payload) {
      setBuilderPayload(payload as BuilderPayload);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <NavBar view={view} onNav={handleNav} />

      <main>
        {loading ? (
          <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
            Loading…
          </div>
        ) : !user ? (
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center max-w-sm px-4">
              <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center mx-auto mb-4">
                <span className="text-primary-foreground text-xl font-bold">C</span>
              </div>
              <h1 className="text-2xl font-bold text-primary">College Brief Lab</h1>
              <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
                Turn prompts, readings, and opportunities into structured briefs and plans.
              </p>
              <p className="text-sm text-muted-foreground mt-6">
                Sign in to create and save briefs and opportunities.
              </p>
              <button
                onClick={signInGoogle}
                className="mt-4 px-6 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                Sign in with Google
              </button>
            </div>
          </div>
        ) : (
          <>
            {view === "dashboard" && <Dashboard onNav={handleNav} />}
            {view === "builder" && (
              <BriefBuilder
                key={JSON.stringify(builderPayload)}
                initialPrompt={builderPayload.prompt}
                linkedOpportunityId={builderPayload.linkedOpportunityId}
              />
            )}
            {view === "opportunities" && <OpportunityPlanner onNav={handleNav} />}
          </>
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
