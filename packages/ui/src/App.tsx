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
import { PreparingScreen } from "@/components/PreparingScreen";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { wsClient } from "@/lib/ws";
import { api } from "@/lib/api";

export function App() {
  const fetchWorkspaces = useWorkspaceStore((s) => s.fetchWorkspaces);
  const navigate = useNavigate();
  const location = useLocation();
  const [gatewayReady, setGatewayReady] = useState(false);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const [isOnboarded, setIsOnboarded] = useState(false);

  // Poll gateway readiness in the background (browser install, etc.)
  useEffect(() => {
    let cancelled = false;
    async function waitForReady() {
      while (!cancelled) {
        try {
          const res = await fetch("/api/health");
          const data = await res.json();
          if (data.ready) {
            setGatewayReady(true);
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

  // Check onboarding as soon as the gateway responds (doesn't need ready=true)
  useEffect(() => {
    let cancelled = false;
    async function checkOnboarding() {
      while (!cancelled) {
        try {
          const status = await api.onboarding.status();
          setIsOnboarded(status.completed);
          if (!status.completed && location.pathname !== "/onboarding") {
            navigate("/onboarding", { replace: true });
          }
          setCheckingOnboarding(false);
          return;
        } catch {
          // gateway not responding yet, retry
        }
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    checkOnboarding();
    return () => { cancelled = true; };
  }, [navigate, location.pathname]);

  useEffect(() => {
    if (isOnboarded && gatewayReady) {
      wsClient.connect();
      fetchWorkspaces();
      return () => wsClient.disconnect();
    }
  }, [fetchWorkspaces, isOnboarded, gatewayReady]);

  // Show onboarding immediately (don't wait for gateway ready)
  if (!checkingOnboarding && !isOnboarded) {
    return (
      <Routes>
        <Route path="*" element={<OnboardingPage />} />
      </Routes>
    );
  }

  // After onboarding, wait for gateway to be fully ready
  if (!gatewayReady || checkingOnboarding) {
    return <PreparingScreen />;
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
