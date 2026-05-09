import { useAuth } from "@/context/AuthContext";

export type View = "dashboard" | "builder" | "opportunities";

const TABS: { key: View; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "builder", label: "Brief Builder" },
  { key: "opportunities", label: "Opportunities" },
];

type Props = {
  view: View;
  onNav: (v: View) => void;
};

export default function NavBar({ view, onNav }: Props) {
  const { user, profile, loading, signInGoogle, logOut } = useAuth();
  const displayName =
    profile?.username || profile?.name || user?.displayName || user?.email || "User";

  return (
    <header className="bg-white border-b border-border sticky top-0 z-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">
          <span className="font-semibold text-primary text-base tracking-tight whitespace-nowrap">
            College Brief Lab
          </span>

          {user && (
            <nav className="hidden sm:flex items-center gap-0 ml-6">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => onNav(t.key)}
                  className={`px-3 py-1.5 text-sm rounded transition-colors ${
                    view === t.key
                      ? "text-primary font-semibold bg-primary/8"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </nav>
          )}

          <div className="flex items-center gap-3 ml-auto">
            {loading ? (
              <span className="text-sm text-muted-foreground">Loading…</span>
            ) : user ? (
              <>
                <span className="text-sm text-foreground hidden md:inline">{displayName}</span>
                <button
                  onClick={logOut}
                  className="text-sm px-3 py-1.5 rounded border border-border text-foreground hover:bg-accent transition-colors"
                >
                  Log out
                </button>
              </>
            ) : (
              <button
                onClick={signInGoogle}
                className="text-sm px-4 py-1.5 rounded bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
              >
                Sign in with Google
              </button>
            )}
          </div>
        </div>

        {user && (
          <nav className="sm:hidden flex gap-1 pb-2">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => onNav(t.key)}
                className={`flex-1 text-xs py-1.5 rounded text-center transition-colors ${
                  view === t.key
                    ? "text-primary font-semibold bg-primary/8"
                    : "text-muted-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}
