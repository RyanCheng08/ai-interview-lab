import { createRoot } from "react-dom/client";
import InterviewLab from "@/components/interview-lab";
import { exportPagesProgress, importPagesProgress } from "@/lib/pages-client";
import "@/app/globals.css";
import "@/app/lab.css";

const user = { displayName: "本地学习者" };
const portable = { exportData: exportPagesProgress, importData: importPagesProgress };
createRoot(document.getElementById("root")!).render(
  <InterviewLab user={user} portable={portable} assetBase={import.meta.env.BASE_URL} />,
);
