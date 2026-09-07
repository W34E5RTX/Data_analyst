import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import {
  BarChart3,
  Bell,
  CalendarRange,
  ChevronDown,
  CreditCard,
  Database,
  FileText,
  Home,
  Lightbulb,
  ListFilter,
  Menu,
  Moon,
  Search,
  ShieldCheck,
  Settings,
  Sparkles,
  Sun,
  WandSparkles,
  Users,
  UploadCloud,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  ZAxis,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "./App.css";
import "./refresh.css";
import type { Dataset, DatasetAnalysis, Report } from "./types";

const isLocalDevelopment =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";
const API_URL = import.meta.env.PROD || !isLocalDevelopment
  ? window.location.origin
  : "http://localhost:8000";

type View =
  | "overview"
  | "datasets"
  | "analytics"
  | "ai"
  | "reports"
  | "settings"
  | "billing"
  | "admin";

const navItems: Array<{ id: View; label: string; icon: typeof Home }> = [
  { id: "overview", label: "Overview", icon: Home },
  { id: "datasets", label: "Datasets", icon: Database },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "ai", label: "AI Analyst", icon: Sparkles },
  { id: "reports", label: "Reports", icon: FileText },
  { id: "settings", label: "Settings", icon: Settings },
  { id: "billing", label: "Plans & billing", icon: CreditCard },
  { id: "admin", label: "Admin console", icon: ShieldCheck },
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
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("datamind-user");
    return saved ? JSON.parse(saved) as { name: string; email: string; role: "admin" | "member" } : null;
  });
  const [view, setView] = useState<View>("overview");
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [analysis, setAnalysis] = useState<DatasetAnalysis | null>(null);
  const [isDark, setIsDark] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reportsCount, setReportsCount] = useState(0);
  const [aiQuestionsCount, setAiQuestionsCount] = useState(() => Number(localStorage.getItem("datamind-ai-questions") ?? 0));

  const refresh = () => {
    Promise.all([request<Dataset[]>("/api/datasets"), request<Report[]>("/api/reports")])
      .then(([items, reports]) => {
        setDatasets(items);
        setReportsCount(reports.length);
      })
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
  if (!user) return <AuthScreen onAuthenticated={(account) => { localStorage.setItem("datamind-user", JSON.stringify(account)); setUser(account); }} />;
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
              reportsCount={reportsCount}
              aiQuestionsCount={aiQuestionsCount}
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
          {view === "ai" && <AiAnalyst dataset={activeDataset} onQuestionAsked={() => { const next = aiQuestionsCount + 1; setAiQuestionsCount(next); localStorage.setItem("datamind-ai-questions", String(next)); }} />}
          {view === "reports" && <Reports dataset={activeDataset} onReportCreated={() => setReportsCount((count) => count + 1)} onReportDeleted={() => setReportsCount((count) => Math.max(0, count - 1))} />}
          {view === "settings" && (
            <SettingsView isDark={isDark} setIsDark={setIsDark} />
          )}
          {view === "billing" && <Billing datasets={datasets} />}
          {view === "admin" && user.role === "admin" && <AdminConsole datasets={datasets} user={user} onLogout={() => { localStorage.removeItem("datamind-user"); setUser(null); }} />}
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

function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function Overview({
  datasets,
  loading,
  onUpload,
  onDemo,
  onSelect,
  onNavigate,
  reportsCount,
  aiQuestionsCount,
}: {
  datasets: Dataset[];
  loading: boolean;
  onUpload: (e: ChangeEvent<HTMLInputElement>) => void;
  onDemo: () => void;
  onSelect: (d: Dataset) => void;
  onNavigate: (view: View) => void;
  reportsCount: number;
  aiQuestionsCount: number;
}) {
  return (
    <>
      <section className="overview-intro">
        <div className="overview-intro-copy">
          <div className="eyebrow">Your intelligent data workspace</div>
          <h2>From raw files to confident decisions.</h2>
          <p>
            DataMind AI turns CSV and Excel files into clear analytics, quality
            signals, editable data, and grounded answers for your team.
          </p>
          <div className="overview-capabilities">
            <span><UploadCloud size={14} /> Import data</span>
            <span><BarChart3 size={14} /> Find patterns</span>
            <span><Sparkles size={14} /> Ask AI</span>
            <span><FileText size={14} /> Share reports</span>
          </div>
        </div>
        <div className="overview-intro-mark" aria-hidden="true">
          <Sparkles size={22} />
          <strong>AI-powered</strong>
          <span>analytics workspace</span>
        </div>
      </section>
      <PageHeader
        eyebrow={new Date().toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        })}
        title={`${getTimeGreeting()}, Alex`}
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
          value={reportsCount.toString()}
          detail="Create your first report"
          icon={<FileText />}
        />
        <Stat
          label="AI questions"
          value={aiQuestionsCount.toString()}
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
  const [showFilters, setShowFilters] = useState(false);
  const [removeNullRows, setRemoveNullRows] = useState(true);
  const [downloadMessage, setDownloadMessage] = useState("");
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
  const downloadFilteredData = async () => {
    setDownloadMessage("Preparing cleaned download...");
    try {
      const payload = await request<{ columns: string[]; rows: Array<Record<string, unknown>> }>(`/api/datasets/${dataset.id}/data`);
      const rows = removeNullRows
        ? payload.rows.filter((row) => payload.columns.every((column) => row[column] !== null && row[column] !== undefined && String(row[column]).trim() !== ""))
        : payload.rows;
      const escapeCsv = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
      const csv = [payload.columns, ...rows.map((row) => payload.columns.map((column) => row[column]))]
        .map((row) => row.map(escapeCsv).join(","))
        .join("\n");
      const link = document.createElement("a");
      link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      link.download = `${dataset.name.replace(/\.[^.]+$/, "")}-${removeNullRows ? "cleaned" : "filtered"}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
      setDownloadMessage(`${rows.length.toLocaleString()} rows ready to download.`);
    } catch (error) {
      setDownloadMessage((error as Error).message);
    }
  };
  return (
    <div className="bi-dashboard">
      <section className="bi-masthead">
        <div className="bi-masthead-copy">
          <div className="eyebrow">Dataset analytics / Live workspace</div>
          <h1>{dataset.name.replace(/\.[^.]+$/, "")}</h1>
          <p><span className="live-dot" /> Updated just now · {formatNumber(dataset.rows)} rows · {dataset.columns} columns</p>
        </div>
        <div className="bi-masthead-actions">
          <button className="bi-ghost-button"><CalendarRange size={15} /> All time</button>
          <button className="button light-button" onClick={exportAnalysis}><FileText size={16} /> Export</button>
        </div>
      </section>
      <div className="bi-toolbar">
        <div className="bi-toolbar-title"><WandSparkles size={16} /> Executive view</div>
        <div className="bi-toolbar-actions"><button onClick={() => setShowFilters((current) => !current)}><ListFilter size={15} /> Filter</button><button>Last refresh <strong>Now</strong></button></div>
      </div>
      {showFilters && <div className="bi-filter-panel"><label><input type="checkbox" checked={removeNullRows} onChange={(event) => setRemoveNullRows(event.target.checked)} /> Remove rows with null or blank values</label><button className="button primary" onClick={downloadFilteredData}><FileText size={15} /> Download filtered CSV</button></div>}
      {downloadMessage && <div className="download-message">{downloadMessage}</div>}
      <div className="stats-grid analysis-stats bi-kpis">
        {analysis.metrics.map((metric) => (
          <div className="metric-card" key={metric.label}>
            <span className="metric-kicker">Computed KPI</span>
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
      <div className="bi-main-grid">
        <div className="bi-visuals">
          <div className="bi-section-label"><span>Performance signals</span><small>{analysis.charts.length} visualizations · Auto-selected from your data</small></div>
          <div className="chart-grid bi-chart-grid">
            {analysis.charts.map((chart, index) => (
              <ChartCard key={chart.title} chart={chart} featured={index === 0} />
            ))}
          </div>
        </div>
        <aside className="bi-rail">
          <div className="bi-section-label"><span>Decision brief</span><small>AI assisted</small></div>
          <section className="bi-brief-card">
            <div className="bi-brief-icon"><Sparkles size={17} /></div>
            <h2>What matters now</h2>
            <p>{analysis.insights[0]?.description ?? "Your dataset is ready for exploration."}</p>
            <button onClick={() => document.querySelector(".lower-grid")?.scrollIntoView({ behavior: "smooth" })}>View signals <span>→</span></button>
          </section>
          <section className="bi-health-card">
            <div className="bi-health-top"><span>Data health</span><strong>{analysis.quality.score}<small>/100</small></strong></div>
            <div className="quality-meter"><i style={{ width: `${analysis.quality.score}%` }} /></div>
            <p>{analysis.quality.recommendations[0]}</p>
          </section>
        </aside>
      </div>
      <div className="lower-grid bi-lower-grid">
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
    </div>
  );
}
function ChartCard({ chart, featured = false }: { chart: DatasetAnalysis["charts"][number]; featured?: boolean }) {
  const Chart = chart.kind === "bar" || chart.kind === "histogram" ? BarChart : AreaChart;
  const pieColors = ["#0c5946", "#1da47b", "#e56d4f", "#e9b44c", "#6c7ce5", "#8caaa0", "#d49b87", "#45645a"];
  return (
    <section className={featured ? "panel chart-card featured-chart" : "panel chart-card"}>
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
        {chart.kind === "pie" ? (
          <PieChart>
            <Pie data={chart.points} dataKey="value" nameKey="label" innerRadius={55} outerRadius={82} paddingAngle={3} stroke="none">
              {chart.points.map((point, index) => <Cell key={point.label} fill={pieColors[index % pieColors.length]} />)}
            </Pie>
            <Tooltip formatter={(value) => typeof value === "number" ? value.toLocaleString() : String(value ?? "")} />
          </PieChart>
        ) : chart.kind === "scatter" ? (
          <ScatterChart margin={{ top: 12, right: 12, bottom: 8, left: 4 }}>
            <CartesianGrid stroke="#e5e9e7" />
            <XAxis type="number" dataKey="value" name={chart.x_label} tick={{ fill: "#84918b", fontSize: 11 }} />
            <YAxis type="number" dataKey="secondary" name={chart.y_label} tick={{ fill: "#84918b", fontSize: 11 }} />
            <ZAxis range={[38, 38]} />
            <Tooltip cursor={{ strokeDasharray: "3 3" }} />
            <Scatter data={chart.points} fill="#e56d4f" />
          </ScatterChart>
        ) : chart.kind === "radar" ? (
          <RadarChart data={chart.points}>
            <PolarGrid stroke="#dbe7e0" />
            <PolarAngleAxis dataKey="label" tick={{ fill: "#6f7d77", fontSize: 10 }} />
            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: "#9aa8a1", fontSize: 9 }} />
            <Radar dataKey="value" stroke="#0c5946" fill="#1da47b" fillOpacity={0.34} />
            <Tooltip />
          </RadarChart>
        ) : chart.kind === "bar" || chart.kind === "histogram" ? (
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
            <Bar dataKey="value" fill={chart.kind === "histogram" ? "#1da47b" : "#e4775c"} radius={[4, 4, 0, 0]} />
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
      {chart.kind === "pie" && (
        <div className="pie-legend">
          {chart.points.map((point, index) => (
            <span key={point.label}>
              <i style={{ background: pieColors[index % pieColors.length] }} />
              {point.label}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
function AiAnalyst({ dataset, onQuestionAsked }: { dataset?: Dataset; onQuestionAsked: () => void }) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; text: string }>>([]);
  const [thinking, setThinking] = useState(false);
  const [dataRows, setDataRows] = useState<Array<Record<string, unknown>>>([]);
  const [dataTypes, setDataTypes] = useState<Record<string, string>>({});
  const [editorMessage, setEditorMessage] = useState("");
  const [savingData, setSavingData] = useState(false);
  const dataColumns = dataRows.length ? Object.keys(dataRows[0]) : [];
  useEffect(() => {
    if (!dataset) return;
    request<{ columns: string[]; rows: Array<Record<string, unknown>> }>(
      `/api/datasets/${dataset.id}/data`,
    )
      .then(({ columns, rows }) => {
        setDataRows(rows);
        setDataTypes(
          Object.fromEntries(
            columns.map((column) => {
              const value = rows.find((row) => row[column] !== null)?.[column];
              return [
                column,
                typeof value === "number"
                  ? "number"
                  : typeof value === "boolean"
                    ? "boolean"
                    : "text",
              ];
            }),
          ),
        );
      })
      .catch((error: Error) => setEditorMessage(error.message));
  }, [dataset]);
  const saveData = async () => {
    if (!dataset) return;
    setSavingData(true);
    setEditorMessage("");
    try {
      await request(`/api/datasets/${dataset.id}/data`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: dataRows, types: dataTypes }),
      });
      setEditorMessage("Changes saved. Analytics will use the updated data.");
    } catch (error) {
      setEditorMessage((error as Error).message);
    } finally {
      setSavingData(false);
    }
  };
  const ask = async () => {
    if (!question || !dataset) return;
    const currentQuestion = question;
    setQuestion("");
    setMessages((current) => [...current, { role: "user", text: currentQuestion }]);
    setThinking(true);
    try {
      const result = await request<{ answer: string }>("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataset_id: dataset.id, question: currentQuestion }),
      });
      setMessages((current) => [...current, { role: "assistant", text: result.answer }]);
      onQuestionAsked();
    } catch (e) {
      setMessages((current) => [...current, { role: "assistant", text: (e as Error).message }]);
    } finally {
      setThinking(false);
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
          {messages.map((message, index) => (
            <div className={message.role === "user" ? "chat-message user-message" : "chat-message assistant"} key={`${message.role}-${index}`}>
              <div className={message.role === "user" ? "user-avatar small" : "ai-avatar"}>{message.role === "user" ? "AK" : <Sparkles size={16} />}</div>
              <p>{message.text}</p>
            </div>
          ))}
          {thinking && <div className="ai-thinking"><Sparkles size={15} /> Computing a grounded answer...</div>}
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
              disabled={!question || !dataset || thinking}
            >
              Ask <span>→</span>
            </button>
          </div>
          {messages.length > 0 && <button className="clear-chat" onClick={() => setMessages([])}>Clear conversation</button>}
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
      <section className="data-editor">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Dataset editor</span>
            <h2>Update values and data types</h2>
          </div>
          <button className="button primary" onClick={saveData} disabled={!dataset || !dataRows.length || savingData}>
            {savingData ? "Saving..." : "Save changes"}
          </button>
        </div>
        {editorMessage && <p className="editor-message">{editorMessage}</p>}
        {!dataset ? (
          <p className="empty-state">Upload or select a dataset to edit it.</p>
        ) : dataRows.length ? (
          <div className="data-editor-scroll">
            <table className="editor-table">
              <thead>
                <tr>
                  {dataColumns.map((column) => (
                    <th key={column}>
                      <span>{column}</span>
                      <select
                        value={dataTypes[column] ?? "text"}
                        onChange={(event) =>
                          setDataTypes((current) => ({ ...current, [column]: event.target.value }))
                        }
                        aria-label={`Type for ${column}`}
                      >
                        <option value="text">Text</option>
                        <option value="number">Number</option>
                        <option value="boolean">Boolean</option>
                        <option value="date">Date</option>
                      </select>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dataRows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {dataColumns.map((column) => (
                      <td key={column}>
                        <input
                          value={row[column] == null ? "" : String(row[column])}
                          onChange={(event) =>
                            setDataRows((current) =>
                              current.map((item, index) =>
                                index === rowIndex ? { ...item, [column]: event.target.value } : item,
                              ),
                            )
                          }
                          aria-label={`${column}, row ${rowIndex + 1}`}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-state">Loading dataset rows...</p>
        )}
      </section>
    </>
  );
}
function Reports({ dataset, onReportCreated, onReportDeleted }: { dataset?: Dataset; onReportCreated: () => void; onReportDeleted: () => void }) {
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
      onReportCreated();
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
    onReportDeleted();
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

function Billing({ datasets }: { datasets: Dataset[] }) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const totalRows = datasets.reduce((sum, dataset) => sum + dataset.rows, 0);
  const dataUsage = Math.min(Math.round((totalRows / 100000) * 100), 100);
  const sendInvite = () => {
    if (!email.trim() || !email.includes("@")) return;
    setMessage(`Invite ready for ${email.trim()}. Connect your email provider to send it.`);
    setEmail("");
    setInviteOpen(false);
  };
  return (
    <>
      <PageHeader
        eyebrow="Workspace plan"
        title="Plans & billing"
        copy="Scale your workspace when your team and data grow."
      />
      {message && <div className="report-message">{message}</div>}
      <section className="billing-hero">
        <div>
          <span className="eyebrow">Current plan</span>
          <h2>Free workspace</h2>
          <p>Perfect for exploring DataMind with your team.</p>
        </div>
        <button className="button primary" onClick={() => setInviteOpen(true)}>
          Invite teammate
        </button>
      </section>
      {inviteOpen && (
        <section className="invite-panel">
          <label htmlFor="invite-email">Teammate email</label>
          <div className="invite-form">
            <input id="invite-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.com" />
            <button className="button primary" onClick={sendInvite}>Create invite</button>
          </div>
        </section>
      )}
      <div className="usage-grid">
        <section className="panel usage-panel">
          <div className="usage-heading"><span>Datasets</span><strong>{datasets.length} / 10</strong></div>
          <div className="usage-track"><i style={{ width: `${Math.max(datasets.length * 10, 3)}%` }} /></div>
          <p>Upload up to 10 datasets in the Free workspace.</p>
        </section>
        <section className="panel usage-panel">
          <div className="usage-heading"><span>Rows analyzed</span><strong>{totalRows.toLocaleString()} / 100,000</strong></div>
          <div className="usage-track"><i style={{ width: `${Math.max(dataUsage, 3)}%` }} /></div>
          <p>Computed rows across your connected datasets.</p>
        </section>
      </div>
      <div className="plan-grid">
        <section className="panel plan-panel">
          <span className="eyebrow">For individuals</span>
          <h2>Free</h2>
          <strong className="plan-price">$0 <small>/ month</small></strong>
          <p>Explore the full analytics workflow with a small workspace.</p>
          <ul><li>10 datasets</li><li>100,000 analyzed rows</li><li>AI Analyst and PDF reports</li></ul>
          <button className="button secondary" disabled>Current plan</button>
        </section>
        <section className="panel plan-panel featured-plan">
          <span className="plan-badge">Recommended</span>
          <span className="eyebrow">For growing teams</span>
          <h2>Team</h2>
          <strong className="plan-price">$39 <small>/ month</small></strong>
          <p>Bring your team into one governed workspace with more room to grow.</p>
          <ul><li>Unlimited datasets</li><li>5 million analyzed rows</li><li>Team permissions and shared reports</li></ul>
          <button className="button primary" onClick={() => setMessage("Team plan checkout is ready to connect to Stripe.")}>Upgrade to Team</button>
        </section>
      </div>
    </>
  );
}

type Account = { name: string; email: string; role: "admin" | "member" };

function AuthScreen({ onAuthenticated }: { onAuthenticated: (account: Account) => void }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("Alex Kim");
  const [email, setEmail] = useState("alex@acmeanalytics.com");
  const [password, setPassword] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!email || password.length < 4) return;
    onAuthenticated({ name: mode === "signup" ? name || "New member" : "Alex Kim", email, role: "admin" });
  };
  return (
    <div className="auth-screen">
      <div className="auth-aside"><span className="brand-mark">D</span><h1>DataMind <em>AI</em></h1><p>Turn messy business data into decisions your whole team can trust.</p><div className="auth-proof"><Sparkles size={18} /><span>Grounded analysis, editable datasets, shareable reports.</span></div></div>
      <main className="auth-card">
        <span className="eyebrow">{mode === "login" ? "Welcome back" : "Start your workspace"}</span>
        <h2>{mode === "login" ? "Sign in to DataMind" : "Create your account"}</h2>
        <p className="auth-copy">{mode === "login" ? "Continue to your team analytics workspace." : "Set up a workspace and start exploring your data."}</p>
        <form onSubmit={submit}>
          {mode === "signup" && <label>Full name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Alex Kim" /></label>}
          <label>Work email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" required /></label>
          <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 4 characters" minLength={4} required /></label>
          <button className="button primary auth-submit" type="submit">{mode === "login" ? "Sign in" : "Create workspace"}</button>
        </form>
        <button className="auth-switch" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
          {mode === "login" ? "New to DataMind? Create an account" : "Already have an account? Sign in"}
        </button>
        <small className="auth-note">Demo authentication is local. Connect your identity provider before production use.</small>
      </main>
    </div>
  );
}

function AdminConsole({ datasets, user, onLogout }: { datasets: Dataset[]; user: Account; onLogout: () => void }) {
  const [memberEmail, setMemberEmail] = useState("");
  const [message, setMessage] = useState("");
  const invite = () => {
    if (!memberEmail.includes("@")) return;
    setMessage(`Invitation prepared for ${memberEmail}.`);
    setMemberEmail("");
  };
  return (
    <>
      <PageHeader eyebrow="Workspace administration" title="Admin console" copy="Manage members, governance, and workspace activity." action={<button className="button secondary" onClick={onLogout}>Sign out</button>} />
      {message && <div className="report-message">{message}</div>}
      <div className="admin-stats"><section className="panel admin-stat"><Users size={18} /><strong>1</strong><span>Active member</span></section><section className="panel admin-stat"><Database size={18} /><strong>{datasets.length}</strong><span>Connected datasets</span></section><section className="panel admin-stat"><ShieldCheck size={18} /><strong>100%</strong><span>Workspace health</span></section></div>
      <div className="admin-grid"><section className="panel admin-panel"><div className="eyebrow">Workspace owner</div><h2>{user.name}</h2><p>{user.email}</p><span className="status ready">Admin</span></section><section className="panel admin-panel"><div className="eyebrow">Invite a member</div><h2>Grow your team</h2><p>Give a teammate access to shared analysis and reports.</p><div className="invite-form"><input type="email" value={memberEmail} onChange={(event) => setMemberEmail(event.target.value)} placeholder="teammate@company.com" /><button className="button primary" onClick={invite}>Invite</button></div></section></div>
      <section className="panel admin-panel activity-panel"><div className="eyebrow">Recent activity</div><h2>Workspace is ready</h2><p>Dataset uploads, edits, AI questions, and generated reports will appear here as your team works.</p></section>
    </>
  );
}

export default App;
