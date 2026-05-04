import { Routes, Route, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useRole } from "@/hooks/useRole";
import Sidebar from "@/components/layout/Sidebar";
import Home from "@/pages/Home";
import Upload from "@/pages/Upload";
import ReviewExtraction from "@/pages/ReviewExtraction";
import PMReview from "@/pages/PMReview";
import CodeFix from "@/pages/CodeFix";
import EngineerReview from "@/pages/EngineerReview";
import EMSignoff from "@/pages/EMSignoff";
import RunTimeline from "@/pages/RunTimeline";
import AdminConfig from "@/pages/AdminConfig";
import JiraBoard from "@/pages/JiraBoard";
import Analytics from "@/pages/Analytics";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  const { role, setRole } = useRole();

  return (
    <div className="flex min-h-screen">
      <Sidebar role={role} onRoleChange={setRole} />
      <ScrollToTop />
      <main className="min-h-screen flex-1 p-4 pt-16 lg:ml-64 lg:p-8 lg:pt-8">
        <div className="page-enter">
          <Routes>
            <Route path="/" element={<Home role={role} />} />
            <Route path="/upload" element={<Upload role={role} />} />
            <Route path="/review" element={<ReviewExtraction role={role} />} />
            <Route path="/review/:runId" element={<ReviewExtraction role={role} />} />
            <Route path="/pm-review" element={<PMReview role={role} />} />
            <Route path="/pm-review/:runId" element={<PMReview role={role} />} />
            <Route path="/code-fix" element={<CodeFix role={role} />} />
            <Route path="/code-fix/:runId" element={<CodeFix role={role} />} />
            <Route path="/engineer-review" element={<EngineerReview role={role} />} />
            <Route path="/engineer-review/:runId" element={<EngineerReview role={role} />} />
            <Route path="/em-signoff" element={<EMSignoff role={role} />} />
            <Route path="/em-signoff/:runId" element={<EMSignoff role={role} />} />
            <Route path="/analytics" element={<Analytics role={role} />} />
            <Route path="/timeline" element={<RunTimeline />} />
            <Route path="/timeline/:runId" element={<RunTimeline />} />
            <Route path="/admin" element={<AdminConfig role={role} />} />
            <Route path="/jira-board" element={<JiraBoard />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
