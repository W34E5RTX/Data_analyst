import { useEffect, useState, type ChangeEvent } from "react";
import {
  BarChart3,
  Bell,
  ChevronDown,
  Database,
  FileText,
  Home,
  Lightbulb,
  Menu,
  Moon,
  Search,
  Settings,
  Sparkles,
  Sun,
  UploadCloud,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "./App.css";
import type { Dataset, DatasetAnalysis, Report } from "./types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

type View =
  "overview" | "datasets" | "analytics" | "ai" | "reports" | "settings";

const navItems: Array<{ id: View; label: string; icon: typeof Home }> = [
  { id: "overview", label: "Overview", icon: Home },
  { id: "datasets", label: "Datasets", icon: Database },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "ai", label: "AI Analyst", icon: Sparkles },
  { id: "reports", label: "Reports", icon: FileText },
  { id: "settings", label: "Settings", icon: Settings },
];

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, init);
  if (!response.ok)
    throw new Error(
      (await response.json().catch(() => null))?.detail ??
        "The analytics service is unavailable.",
    );
  return response.json() as Promise<T>;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-IN", {
    notation: value > 999999 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

function App() {
  const [view, setView] = useState<View>("overview");
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [analysis, setAnalysis] = useState<DatasetAnalysis | null>(null);
  const [isDark, setIsDark] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = () => {
    request<Dataset[]>("/api/datasets")
      .then(setDatasets)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(refresh, []);

  const selectDataset = async (dataset: Dataset) => {
    setError("");
    try {
      setAnalysis(
        await request<DatasetAnalysis>(`/api/datasets/${dataset.id}/analysis`),
      );
      setView("analytics");
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const dataset = await request<Dataset>("/api/datasets/upload", {
        method: "POST",
        body: form,
      });
      setDatasets((current) => [dataset, ...current]);
      await selectDataset(dataset);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const tryDemo = async () => {
    setLoading(true);
    setError("");
    try {
      const dataset = await request<Dataset>("/api/datasets/demo", {
        method: "POST",
      });
      setDatasets((current) => [dataset, ...current]);
      await selectDataset(dataset);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const activeDataset = analysis?.dataset ?? datasets[0];
  return (
    <div className={isDark ? "app dark" : "app"}>
      <aside className={mobileOpen ? "sidebar open" : "sidebar"}>
        <div className="brand">
          <span className="brand-mark">D</span>
          <span>
            DataMind <em>AI</em>
          </span>
          <button
            className="icon-button sidebar-close"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>
        <div className="workspace">
          <div className="workspace-avatar">AC</div>
          <div>
            <small>Workspace</small>
            <strong>Acme Analytics</strong>
          </div>
          <ChevronDown size={15} />
        </div>
        <nav>
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={view === id ? "nav-item active" : "nav-item"}
              onClick={() => {
                setView(id);
                setMobileOpen(false);
              }}
            >
              <Icon size={18} />
              <span>{label}</span>
              {id === "ai" && <span className="new-badge">NEW</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="help-box">
            <div className="help-icon">
              <Lightbulb size={16} />
            </div>
            <strong>Need a hand?</strong>
            <p>Ask our AI analyst about your data.</p>
            <button onClick={() => setView("ai")}>
              Open analyst <span>→</span>
            </button>
          </div>
          <div className="user">
            <div className="user-avatar">AK</div>
            <div>
              <strong>Alex Kim</strong>
              <small>Admin</small>
            </div>
            <ChevronDown size={15} />
          </div>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu size={21} />
          </button>
          <div className="search">
            <Search size={17} />
            <input placeholder="Search anything..." aria-label="Search" />
          </div>
          <div className="top-actions">
            <button
              className="icon-button"
              onClick={() => setIsDark(!isDark)}
              aria-label="Toggle theme"
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              className="icon-button notification"
              aria-label="Notifications"
            >
              <Bell size={18} />
              <i />
            </button>
            <div className="top-user">
              <span>AK</span>
              <ChevronDown size={15} />
            </div>
          </div>
        </header>
        <div className="content">
          {error && (
            <div className="error-banner">
              {error}
              <button onClick={() => setError("")} aria-label="Dismiss error">
                <X size={15} />
              </button>
            </div>
          )}
          {view === "overview" && (
            <Overview
              datasets={datasets}
              loading={loading}
              onUpload={upload}
              onDemo={tryDemo}
              onSelect={selectDataset}
              onNavigate={setView}
            />
          )}
          {view === "datasets" && (
            <Datasets
              datasets={datasets}
              loading={loading}
              onUpload={upload}
              onDemo={tryDemo}
              onSelect={selectDataset}
            />
          )}
          {view === "analytics" && (
            <Analytics analysis={analysis} dataset={activeDataset} />
          )}
          {view === "ai" && <AiAnalyst dataset={activeDataset} />}
          {view === "reports" && <Reports dataset={activeDataset} />}
          {view === "settings" && (
            <SettingsView isDark={isDark} setIsDark={setIsDark} />
          )}
        </div>
      </main>
    </div>
  );
}

function PageHeader({
  eyebrow,
  title,
  copy,
  action,
}: {
  eyebrow: string;
  title: string;
  copy: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{copy}</p>
      </div>
      {action}
    </div>
  );
}
function UploadButton({
  onUpload,
}: {
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className="button primary">
      <UploadCloud size={17} /> Upload dataset
      <input type="file" accept=".csv,.xlsx,.xls" onChange={onUpload} hidden />
    </label>
  );
}
function EmptyState({
  onUpload,
  onDemo,
}: {
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onDemo: () => void;
}) {
  return (
    <div className="empty-state">
      <div className="empty-illustration">
        <Database size={29} />
      </div>
      <h2>Start with your data</h2>
      <p>
        Upload a CSV or Excel file and DataMind will profile it, find patterns,
        and build your first dashboard.
      </p>
      <div className="empty-actions">
        <UploadButton onUpload={onUpload} />
        <button className="button secondary" onClick={onDemo}>
          Try demo dataset
        </button>
      </div>
      <small>CSV, XLSX, or XLS up to 50 MB</small>
    </div>
  );
}
function Overview({
  datasets,
  loading,
  onUpload,
  onDemo,
  onSelect,
  onNavigate,
}: {
  datasets: Dataset[];
  loading: boolean;
  onUpload: (e: ChangeEvent<HTMLInputElement>) => void;
  onDemo: () => void;
  onSelect: (d: Dataset) => void;
  onNavigate: (view: View) => void;
}) {
  return (
    <>
      <PageHeader
        eyebrow="Monday, September 7, 2026"
        title="Good morning, Alex"
        copy="Here's what's happening with your data today."
        action={<UploadButton onUpload={onUpload} />}
      />
      <div className="stats-grid">
        <Stat
          label="Total datasets"
          value={datasets.length.toString()}
          detail="Connected sources"
          icon={<Database />}
        />
        <Stat
          label="Analyses completed"
          value={datasets.filter((d) => d.status === "ready").length.toString()}
          detail="Ready to explore"
          icon={<BarChart3 />}
        />
        <Stat
          label="Reports generated"
          value="0"
          detail="Create your first report"
          icon={<FileText />}
        />
        <Stat
          label="AI questions"
          value="0"
          detail="Ask your data anything"
          icon={<Sparkles />}
        />
      </div>
      {loading ? (
        <LoadingState />
      ) : datasets.length === 0 ? (
        <EmptyState onUpload={onUpload} onDemo={onDemo} />
      ) : (
        <>
          <div className="section-heading">
            <h2>Recent datasets</h2>
            <button
              className="text-button"
              onClick={() => onNavigate("datasets")}
            >
              View all <span>→</span>
            </button>
          </div>
          <DatasetTable datasets={datasets.slice(0, 5)} onSelect={onSelect} />
        </>
      )}
    </>
  );
}
function Stat({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="stat-card">
      <div className="stat-icon">{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}
function DatasetTable({
  datasets,
  onSelect,
}: {
  datasets: Dataset[];
  onSelect: (dataset: Dataset) => void;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Rows</th>
            <th>Columns</th>
            <th>Quality</th>
            <th>Status</th>
            <th>Created</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {datasets.map((dataset) => (
            <tr key={dataset.id} onClick={() => onSelect(dataset)}>
              <td>
                <div className="dataset-name">
                  <span className="file-icon">
                    <FileText size={16} />
                  </span>
                  <div>
                    <strong>{dataset.name}</strong>
                    <small>{dataset.file_type.toUpperCase()}</small>
                  </div>
                </div>
              </td>
              <td>{formatNumber(dataset.rows)}</td>
              <td>{dataset.columns}</td>
              <td>
                <div className="quality">
                  <span>{dataset.quality_score}</span>
                  <div>
                    <i style={{ width: `${dataset.quality_score}%` }} />
                  </div>
                </div>
              </td>
              <td>
                <span className={`status ${dataset.status}`}>
                  {dataset.status}
                </span>
              </td>
              <td>{new Date(dataset.created_at).toLocaleDateString()}</td>
              <td>
                <button
                  className="row-arrow"
                  aria-label={`Open ${dataset.name}`}
                >
                  →
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function Datasets({
  datasets,
  loading,
  onUpload,
  onDemo,
  onSelect,
}: {
  datasets: Dataset[];
  loading: boolean;
  onUpload: (e: ChangeEvent<HTMLInputElement>) => void;
  onDemo: () => void;
  onSelect: (d: Dataset) => void;
}) {
  return (
    <>
      <PageHeader
        eyebrow="Workspace library"
        title="Datasets"
        copy="Your connected data sources and their health at a glance."
        action={<UploadButton onUpload={onUpload} />}
      />
      {loading ? (
        <LoadingState />
      ) : datasets.length ? (
        <DatasetTable datasets={datasets} onSelect={onSelect} />
      ) : (
        <EmptyState onUpload={onUpload} onDemo={onDemo} />
      )}
    </>
  );
}
function LoadingState() {
  return (
    <div className="loading-state">
      <div />
      <div />
      <div />
      <p>Connecting to your analytics workspace...</p>
    </div>
  );
}
function Analytics({
  analysis,
  dataset,
}: {
  analysis: DatasetAnalysis | null;
  dataset?: Dataset;
}) {
  if (!analysis || !dataset)
    return (
      <>
        <PageHeader
          eyebrow="Analytics"
          title="No dataset selected"
          copy="Upload a dataset to unlock automatic analysis."
        />
        <div className="empty-state compact">
          <div className="empty-illustration">
            <BarChart3 size={29} />
          </div>
          <h2>Your dashboard is waiting</h2>
          <p>
            Once a dataset is uploaded, this view will show computed KPIs,
            trends, and quality signals.
          </p>
        </div>
      </>
    );
  const exportAnalysis = () => {
    const blob = new Blob([JSON.stringify(analysis, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${dataset.name.replace(/\.[^.]+$/, "")}-analysis.json`;
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <>
      <PageHeader
        eyebrow="Dataset analytics"
        title={dataset.name}
        copy={`${formatNumber(dataset.rows)} rows · ${dataset.columns} columns · quality score ${dataset.quality_score}/100`}
        action={
          <button className="button secondary" onClick={exportAnalysis}>
            <FileText size={16} /> Export analysis
          </button>
        }
      />
      <div className="stats-grid analysis-stats">
        {analysis.metrics.map((metric) => (
          <div className="metric-card" key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            {metric.change && (
              <small className={metric.trend}>
                {metric.trend === "up"
                  ? "↑"
                  : metric.trend === "down"
                    ? "↓"
                    : "•"}{" "}
                {metric.change}
              </small>
            )}
          </div>
        ))}
      </div>
      <div className="chart-grid">
        {analysis.charts.map((chart) => (
          <ChartCard key={chart.title} chart={chart} />
        ))}
      </div>
      <div className="lower-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">AI-generated</div>
              <h2>Signals worth knowing</h2>
            </div>
            <Sparkles size={19} />
          </div>
          {analysis.insights.map((insight) => (
            <div className="insight" key={insight.id}>
              <span className={`severity ${insight.severity}`} />{" "}
              <div>
                <strong>{insight.title}</strong>
                <p>{insight.description}</p>
              </div>
              {insight.metric && <b>{insight.metric}</b>}
            </div>
          ))}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Data health</div>
              <h2>Quality profile</h2>
            </div>
            <span className="score">
              {analysis.quality.score}
              <small>/100</small>
            </span>
          </div>
          <div className="quality-meter">
            <i style={{ width: `${analysis.quality.score}%` }} />
          </div>
          <div className="quality-list">
            <span>
              Missing values <b>{analysis.quality.missing_values}</b>
            </span>
            <span>
              Duplicate rows <b>{analysis.quality.duplicate_rows}</b>
            </span>
            <span>
              Detected outliers <b>{analysis.quality.outliers}</b>
            </span>
          </div>
          {analysis.quality.recommendations.map((item) => (
            <p className="recommendation" key={item}>
              • {item}
            </p>
          ))}
        </section>
      </div>
    </>
  );
}
function ChartCard({ chart }: { chart: DatasetAnalysis["charts"][number] }) {
  const Chart = chart.kind === "bar" ? BarChart : AreaChart;
  return (
    <section className="panel chart-card">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">{chart.x_label}</div>
          <h2>{chart.title}</h2>
        </div>
        <button className="icon-button" aria-label="Chart options">
          •••
        </button>
      </div>
      <ResponsiveContainer width="100%" height={230}>
        {chart.kind === "bar" ? (
          <Chart data={chart.points}>
            <CartesianGrid vertical={false} stroke="#e5e9e7" />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#84918b", fontSize: 11 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#84918b", fontSize: 11 }}
            />
            <Tooltip />
            <Bar dataKey="value" fill="#e4775c" radius={[4, 4, 0, 0]} />
          </Chart>
        ) : (
          <Chart data={chart.points}>
            <defs>
              <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#5b8c7a" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#5b8c7a" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#e5e9e7" />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#84918b", fontSize: 11 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#84918b", fontSize: 11 }}
            />
            <Tooltip />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#5b8c7a"
              strokeWidth={2.5}
              fill="url(#chartFill)"
            />
          </Chart>
        )}
      </ResponsiveContainer>
    </section>
  );
}
function AiAnalyst({ dataset }: { dataset?: Dataset }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const ask = async () => {
    if (!question || !dataset) return;
    setAnswer("Analyzing the computed facts from your dataset...");
    try {
      const result = await request<{ answer: string }>("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataset_id: dataset.id, question }),
      });
      setAnswer(result.answer);
    } catch (e) {
      setAnswer((e as Error).message);
    }
  };
  return (
    <>
      <PageHeader
        eyebrow="AI analyst"
        title="Ask your data anything"
        copy={
          dataset
            ? `Grounded in computed analytics for ${dataset.name}.`
            : "Select a dataset to start a grounded conversation."
        }
      />
      <div className="ai-layout">
        <div className="chat-panel">
          <div className="chat-message assistant">
            <div className="ai-avatar">
              <Sparkles size={16} />
            </div>
            <div>
              <strong>DataMind Analyst</strong>
              <p>
                I can explain trends, surface anomalies, and turn your computed
                metrics into clear next steps. I will only use verified facts
                from your dataset.
              </p>
            </div>
          </div>
          {answer && (
            <div className="chat-message user-message">
              <div className="user-avatar small">AK</div>
              <p>{answer}</p>
            </div>
          )}
          <div className="chat-input">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && ask()}
              placeholder="Ask anything about your data..."
              disabled={!dataset}
            />
            <button
              className="button primary"
              onClick={ask}
              disabled={!question || !dataset}
            >
              Ask <span>→</span>
            </button>
          </div>
        </div>
        <div className="prompt-panel">
          <span className="eyebrow">Try asking</span>
          {[
            "What changed most recently?",
            "Which segments need attention?",
            "Summarize this dataset",
            "Find unusual patterns",
          ].map((prompt) => (
            <button key={prompt} onClick={() => setQuestion(prompt)}>
              {prompt}
              <span>↗</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
function Reports({ dataset }: { dataset?: Dataset }) {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const loadReports = () => {
    setLoading(true);
    request<Report[]>("/api/reports")
      .then(setReports)
      .catch((error: Error) => setMessage(error.message))
      .finally(() => setLoading(false));
  };
  useEffect(loadReports, []);
  const createReport = async () => {
    if (!dataset) {
      setMessage("Upload a dataset before creating a report.");
      return;
    }
    setMessage("Generating report from computed analytics...");
    try {
      const report = await request<Report>("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataset_id: dataset.id,
          report_type: "Executive Summary",
        }),
      });
      setReports((current) => [report, ...current]);
      setMessage("Report generated successfully.");
    } catch (error) {
      setMessage((error as Error).message);
    }
  };
  const downloadReport = (report: Report) => {
    const link = document.createElement("a");
    link.href = `${API_URL}/api/reports/${report.id}/pdf`;
    link.target = "_blank";
    link.download = `${report.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`;
    link.click();
  };
  const deleteReport = async (reportId: string) => {
    await request(`/api/reports/${reportId}`, { method: "DELETE" });
    setReports((current) => current.filter((report) => report.id !== reportId));
  };
  return (
    <>
      <PageHeader
        eyebrow="Workspace outputs"
        title="Reports"
        copy="Short, shareable reports with computed metrics."
        action={
          <button
            className="button primary"
            onClick={createReport}
            disabled={!dataset}
          >
            <FileText size={17} /> Create report
          </button>
        }
      />
      {message && <div className="report-message">{message}</div>}
      {loading ? (
        <LoadingState />
      ) : reports.length === 0 ? (
        <div className="empty-state compact">
          <div className="empty-illustration">
            <FileText size={29} />
          </div>
          <h2>No reports yet</h2>
          <p>
            Generate a concise PDF with rows, columns, and computed metrics.
          </p>
          <button
            className="button secondary"
            onClick={createReport}
            disabled={!dataset}
          >
            Generate PDF
          </button>
        </div>
      ) : (
        <div className="report-table-wrap">
          <table className="report-table">
            <thead><tr><th>Report</th><th>Dataset</th><th>Type</th><th>Status</th><th>Created</th><th>Action</th></tr></thead>
            <tbody>{reports.map((report) => <tr key={report.id}>
              <td><strong>{report.name}</strong></td><td>{report.dataset_name}</td><td>{report.type}</td>
              <td><span className="status ready">{report.status}</span></td><td>{new Date(report.created_at).toLocaleDateString()}</td>
              <td><div className="report-actions"><button className="button secondary" onClick={() => downloadReport(report)}>Download PDF</button><button className="icon-button" onClick={() => deleteReport(report.id)} aria-label={`Delete ${report.name}`}><X size={16} /></button></div></td>
            </tr>)}</tbody>
          </table>
        </div>
      )}
    </>
  );
}
function SettingsView({
  isDark,
  setIsDark,
}: {
  isDark: boolean;
  setIsDark: (value: boolean) => void;
}) {
  return (
    <>
      <PageHeader
        eyebrow="Workspace controls"
        title="Settings"
        copy="Manage your profile and analysis preferences."
      />
      <div className="settings-grid">
        <section className="panel settings-panel">
          <div className="eyebrow">Profile</div>
          <h2>Alex Kim</h2>
          <p>alex@acmeanalytics.com</p>
          <button className="button secondary">Edit profile</button>
        </section>
        <section className="panel settings-panel">
          <div className="eyebrow">Appearance</div>
          <h2>Theme</h2>
          <p>Choose how DataMind looks for you.</p>
          <div className="theme-options">
            <button
              className={!isDark ? "selected" : ""}
              onClick={() => setIsDark(false)}
            >
              <Sun size={17} /> Light
            </button>
            <button
              className={isDark ? "selected" : ""}
              onClick={() => setIsDark(true)}
            >
              <Moon size={17} /> Dark
            </button>
          </div>
        </section>
      </div>
    </>
  );
}

export default App;
