import { useEffect, useState } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { ChatPage } from "@/pages/Chat";
import { SkillsPage } from "@/pages/Skills";
import { ChannelsPage } from "@/pages/Channels";
import { CronPage } from "@/pages/Cron";
import { SettingsPage } from "@/pages/Settings";
import { OnboardingPage } from "@/pages/Onboarding";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { wsClient } from "@/lib/ws";
import { api } from "@/lib/api";

export function App() {
  const fetchWorkspaces = useWorkspaceStore((s) => s.fetchWorkspaces);
  const navigate = useNavigate();
  const location = useLocation();
  const [preparing, setPreparing] = useState(true);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const [isOnboarded, setIsOnboarded] = useState(false);

  // Wait for the gateway to be fully ready (browser installed, etc.)
  useEffect(() => {
    let cancelled = false;
    async function waitForReady() {
      while (!cancelled) {
        try {
          const res = await fetch("/api/health");
          const data = await res.json();
          if (data.ready) {
            setPreparing(false);
            return;
          }
        } catch {
          // gateway not up yet
        }
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    waitForReady();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (preparing) return;
    async function checkOnboarding() {
      try {
        const status = await api.onboarding.status();
        setIsOnboarded(status.completed);

        // Redirect to onboarding if not completed
        if (!status.completed && location.pathname !== "/onboarding") {
          navigate("/onboarding", { replace: true });
        }
      } catch (err) {
        console.error("Failed to check onboarding status:", err);
      } finally {
        setCheckingOnboarding(false);
      }
    }

    checkOnboarding();
  }, [preparing, navigate, location.pathname]);

  useEffect(() => {
    if (isOnboarded) {
      wsClient.connect();
      fetchWorkspaces();
      return () => wsClient.disconnect();
    }
  }, [fetchWorkspaces, isOnboarded]);

  if (preparing || checkingOnboarding) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">
          {preparing ? "Cortask is being prepared..." : "Loading..."}
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route
        path="*"
        element={
          <div className="flex h-screen">
            <Sidebar />
            <div className="flex flex-1 flex-col overflow-hidden">
              <Header />
              <main className="flex-1 overflow-auto">
                <Routes>
                  <Route path="/" element={<ChatPage />} />
                  <Route path="/skills" element={<SkillsPage />} />
                  <Route path="/channels" element={<ChannelsPage />} />
                  <Route path="/cron" element={<CronPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Routes>
              </main>
            </div>
          </div>
        }
      />
    </Routes>
  );
}
