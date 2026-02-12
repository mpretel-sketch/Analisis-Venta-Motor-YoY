import { useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";

const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/\$/, "");

const currency = (value) =>
  new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value ?? 0);

const percent = (value) =>
  value === null || value === undefined
    ? "—"
    : `${value.toFixed(1)}%`;

const integer = (value) =>
  new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 }).format(value ?? 0);

const normalizeThousandsInText = (text) =>
  String(text || "")
    .replace(/\b\d{1,3}(?:,\d{3})+\b/g, (m) => m.replace(/,/g, "."))
    .replace(/\b\d{4,}\b/g, (m) => integer(Number(m)));

const DEFAULT_PANEL_ORDER = [
  "filters",
  "summary-main",
  "summary-ai",
  "summary-compare",
  "trend",
  "top-impact",
  "smart-alerts",
  "table-alerts",
  "table-growth",
  "table-new",
  "table-lost",
  "clusters",
  "churn",
  "cohorts",
  "distribution",
  "location-analysis",
];

const DraggableBlock = ({ id, order, dragId, onDragStart, onDragOver, onDrop, className = "", children }) => (
  <div
    className={`draggable-block${className ? ` ${className}` : ""}${dragId === id ? " is-dragging" : ""}`}
    style={{ order }}
    draggable
    onDragStart={() => onDragStart(id)}
    onDragOver={(e) => onDragOver(e)}
    onDrop={() => onDrop(id)}
    onDragEnd={() => onDrop(null)}
  >
    <div className="drag-handle" title="Arrastra para reordenar">::</div>
    {children}
  </div>
);

const Table = ({ title, rows, columns, limit = 10, onRowClick, defaultOpen = true }) => {
  const [expanded, setExpanded] = useState(false);
  const [visible, setVisible] = useState(defaultOpen);

  if (!rows?.length) {
    return (
      <section className="panel">
        <div className="panel-head">
          <h3>{title}</h3>
          <button
            type="button"
            className="ghost small"
            onClick={() => setVisible((prev) => !prev)}
          >
            {visible ? "Ocultar" : "Mostrar"}
          </button>
        </div>
        {visible && <p className="muted">Sin registros.</p>}
      </section>
    );
  }

  const shown = expanded ? rows : rows.slice(0, limit);

  return (
    <section className="panel">
      <div className="panel-head">
        <h3>{title}</h3>
        <div className="actions">
          {rows.length > limit && visible && (
            <button
              type="button"
              className="ghost small"
              onClick={() => setExpanded((prev) => !prev)}
            >
              {expanded ? "Mostrar menos" : `Mostrar todo (${rows.length})`}
            </button>
          )}
          <button
            type="button"
            className="ghost small"
            onClick={() => setVisible((prev) => !prev)}
          >
            {visible ? "Ocultar" : "Mostrar"}
          </button>
        </div>
      </div>
      {visible && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {columns.map((col) => (
                  <th key={col.key}>{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((row, idx) => (
                <tr
                  key={`${row.Cliente}-${idx}`}
                  className={onRowClick ? "row-clickable" : undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((col) => (
                    <td key={col.key}>{col.render(row)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default function App() {
  const [file, setFile] = useState(null);
  const [threshold, setThreshold] = useState(-30);
  const [mode, setMode] = useState("month");
  const [monthKey, setMonthKey] = useState(null);
  const [compareMode, setCompareMode] = useState("month");
  const [compareMonthKey, setCompareMonthKey] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [location, setLocation] = useState("all");
  const [impactMin, setImpactMin] = useState("");
  const [impactMax, setImpactMax] = useState("");
  const [varMin, setVarMin] = useState("");
  const [varMax, setVarMax] = useState("");
  const [persistThreshold, setPersistThreshold] = useState(-30);
  const [recoveryThreshold, setRecoveryThreshold] = useState(0);
  const [churnMonths, setChurnMonths] = useState(9);
  const [cohortMetric, setCohortMetric] = useState("active");
  const [showCharts, setShowCharts] = useState(false);
  const [showTopImpact, setShowTopImpact] = useState(false);
  const [showSmartAlerts, setShowSmartAlerts] = useState(false);
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [showMainSummary, setShowMainSummary] = useState(true);
  const [showAiSummary, setShowAiSummary] = useState(true);
  const [showCompareSummary, setShowCompareSummary] = useState(true);
  const [showClusters, setShowClusters] = useState(true);
  const [showChurn, setShowChurn] = useState(true);
  const [showCohorts, setShowCohorts] = useState(true);
  const [showDistribution, setShowDistribution] = useState(true);
  const analyzeAbortRef = useRef(null);
  const analyzeRequestIdRef = useRef(0);
  const [isFileDragOver, setIsFileDragOver] = useState(false);
  const [panelOrder, setPanelOrder] = useState(() => {
    try {
      const saved = localStorage.getItem("early_warning_panel_order");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
    } catch {
      // ignore
    }
    return DEFAULT_PANEL_ORDER;
  });
  const [dragPanelId, setDragPanelId] = useState(null);
  const dragPanelRef = useRef(null);
  const dashboardRef = useRef(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  const applyFiltersAndReload = (next) => {
    if (Object.prototype.hasOwnProperty.call(next, "search")) {
      setSearch(next.search);
    }
    if (Object.prototype.hasOwnProperty.call(next, "location")) {
      setLocation(next.location);
    }
    if (Object.prototype.hasOwnProperty.call(next, "impactMin")) {
      setImpactMin(String(next.impactMin));
    }
    if (Object.prototype.hasOwnProperty.call(next, "impactMax")) {
      setImpactMax(String(next.impactMax));
    }
    if (Object.prototype.hasOwnProperty.call(next, "varMin")) {
      setVarMin(String(next.varMin));
    }
    if (Object.prototype.hasOwnProperty.call(next, "varMax")) {
      setVarMax(String(next.varMax));
    }
    if (!file) {
      setTimeout(() => submitNetSuiteAnalysis(), 0);
    }
  };

  useEffect(() => {
    localStorage.setItem("early_warning_panel_order", JSON.stringify(panelOrder));
  }, [panelOrder]);

  const handlePanelDragStart = (id) => {
    dragPanelRef.current = id;
    setDragPanelId(id);
  };

  const handlePanelDragOver = (event) => {
    event.preventDefault();
  };

  const handlePanelDrop = (targetId) => {
    const sourceId = dragPanelRef.current;
    if (!targetId || !sourceId || sourceId === targetId) {
      dragPanelRef.current = null;
      setDragPanelId(null);
      return;
    }
    const next = [...panelOrder];
    const from = next.indexOf(sourceId);
    const to = next.indexOf(targetId);
    if (from === -1 || to === -1) {
      dragPanelRef.current = null;
      setDragPanelId(null);
      return;
    }
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setPanelOrder(next);
    dragPanelRef.current = null;
    setDragPanelId(null);
  };

  const getPanelOrder = (id) => {
    const idx = panelOrder.indexOf(id);
    return idx === -1 ? DEFAULT_PANEL_ORDER.indexOf(id) : idx;
  };

  const handleDropFile = (event) => {
    event.preventDefault();
    setIsFileDragOver(false);
    const dropped = event.dataTransfer?.files?.[0];
    if (!dropped) return;
    const name = (dropped.name || "").toLowerCase();
    if (!name.endsWith(".xls") && !name.endsWith(".xlsx")) {
      setError("Formato no soportado. Usa .xls o .xlsx");
      return;
    }
    setError(null);
    setFile(dropped);
  };

  const columnDefs = useMemo(() => {
    if (!data?.meta) return [];
    return [
      {
        key: "Cliente",
        label: "Hotel",
        render: (row) => row.Cliente,
      },
      {
        key: "HotelCode",
        label: "Code",
        render: (row) => row.HotelCode ?? "—",
      },
      {
        key: "Ubicacion",
        label: "Ubicación",
        render: (row) => row.Ubicacion ?? "—",
      },
      {
        key: "Prev",
        label: data.meta.previousLabel,
        render: (row) => currency(row.Prev),
      },
      {
        key: "Curr",
        label: data.meta.latestLabel,
        render: (row) => currency(row.Curr),
      },
      {
        key: "VarAbs",
        label: "Variación €",
        render: (row) => currency(row.VarAbs),
      },
      {
        key: "VarPct",
        label: "Variación %",
        render: (row) => percent(row.VarPct),
      },
    ];
  }, [data]);

  const locationColumns = [
    { key: "Ubicacion", label: "Ubicación", render: (row) => row.Ubicacion },
    { key: "Prev", label: "Prev", render: (row) => currency(row.Prev) },
    { key: "Curr", label: "Curr", render: (row) => currency(row.Curr) },
    { key: "VarAbs", label: "Variación €", render: (row) => currency(row.VarAbs) },
    { key: "VarPct", label: "Variación %", render: (row) => percent(row.VarPct) },
  ];

  const heatColor = (value) => {
    if (value === null || value === undefined) return "transparent";
    const v = Math.max(0, Math.min(100, value));
    const alpha = v / 100;
    return `rgba(201, 75, 42, ${0.15 + alpha * 0.55})`;
  };

  const pieColors = [
    "#516BA6",
    "#0F766E",
    "#D9480F",
    "#8B5E34",
    "#334155",
    "#B45309",
    "#0EA5A8",
    "#9F1239",
  ];

  const countryNameMap = {
    ES: "Espana",
    MX: "Mexico",
    PT: "Portugal",
    US: "Estados Unidos",
    CO: "Colombia",
    DE: "Alemania",
    FR: "Francia",
    GB: "Reino Unido",
    IT: "Italia",
    AD: "Andorra",
  };

  const buildPieData = (rows, keyName, { isCountry = false, maxItems = 7 } = {}) => {
    const grouped = new Map();
    (rows || []).forEach((row) => {
      const raw = String(row?.[keyName] ?? "").trim();
      if (!raw) return;
      const value = Number(row?.Curr || 0);
      if (!Number.isFinite(value) || value <= 0) return;

      const normalizedCode = raw.toUpperCase();
      const label = isCountry && normalizedCode.length === 2
        ? (countryNameMap[normalizedCode] || normalizedCode)
        : raw;

      const key = isCountry ? normalizedCode : label;
      const current = grouped.get(key) || {
        name: key,
        label,
        value: 0,
        filterValue: raw,
      };
      current.value += value;
      grouped.set(key, current);
    });

    const list = Array.from(grouped.values()).sort((a, b) => b.value - a.value);
    if (list.length <= maxItems) return list;

    const top = list.slice(0, maxItems);
    const rest = list.slice(maxItems).reduce((acc, row) => acc + row.value, 0);
    if (rest > 0) {
      top.push({ name: "OTROS", label: "Otros", value: rest, filterValue: "" });
    }
    return top;
  };

  const Sparkline = ({ data, metric }) => {
    if (!data?.length) return <span className="muted">—</span>;
    const key = metric === "pct" ? "varPct" : "curr";
    return (
      <div className="sparkline">
        <ResponsiveContainer width="100%" height={60}>
          <LineChart data={data}>
            <Line
              type="monotone"
              dataKey={key}
              stroke={metric === "pct" ? "#c94b2a" : "#0f6b6e"}
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  };

  const locations = useMemo(() => {
    if (!data) return [];
    const set = new Set();
    ["alerts", "growth", "new", "lost"].forEach((key) => {
      data.tables?.[key]?.forEach((row) => {
        if (row.Ubicacion) set.add(row.Ubicacion);
      });
    });
    data.tables?.locations?.forEach((row) => {
      if (row.Ubicacion) set.add(row.Ubicacion);
    });
    return Array.from(set).sort();
  }, [data]);


  const topAlerts10 = useMemo(() => data?.tables?.alerts?.slice(0, 10) || [], [data]);
  const topGrowth10 = useMemo(() => data?.tables?.growth?.slice(0, 10) || [], [data]);
  const locationPieData = useMemo(() => buildPieData(data?.tables?.locations, "Ubicacion"), [data?.tables?.locations]);
  const countryPieData = useMemo(() => buildPieData(data?.clusters?.byCountry || [], "Country", { isCountry: true }), [data?.clusters?.byCountry]);

  const locationPieView = useMemo(() => {
    const total = locationPieData.reduce((acc, row) => acc + row.value, 0) || 1;
    return locationPieData.map((row, idx) => ({
      ...row,
      pct: (row.value / total) * 100,
      color: pieColors[idx % pieColors.length],
    }));
  }, [locationPieData]);

  const countryPieView = useMemo(() => {
    const total = countryPieData.reduce((acc, row) => acc + row.value, 0) || 1;
    return countryPieData.map((row, idx) => ({
      ...row,
      pct: (row.value / total) * 100,
      color: pieColors[idx % pieColors.length],
    }));
  }, [countryPieData]);

  const handleActionableFilter = (f) => {
    if (!f?.type) return;
    if (f.type === "search") applyFiltersAndReload({ search: f.value || "" });
    if (f.type === "location") applyFiltersAndReload({ location: f.value || "all", search: "" });
    if (f.type === "impact_min") applyFiltersAndReload({ impactMin: f.value || "" });
    if (f.type === "impact_max") applyFiltersAndReload({ impactMax: f.value || "" });
    if (f.type === "var_min") applyFiltersAndReload({ varMin: f.value || "" });
    if (f.type === "var_max") applyFiltersAndReload({ varMax: f.value || "" });
  };

  useEffect(() => {
    // Warm backend once to reduce first analyze latency (cold starts on free tier).
    const ctrl = new AbortController();
    fetch(`${API_BASE}/api/health`, { signal: ctrl.signal }).catch(() => {});
    return () => ctrl.abort();
  }, []);

  useEffect(() => {
    if (data?.meta?.monthKey && !monthKey) {
      setMonthKey(data.meta.monthKey);
    }
  }, [data, monthKey]);

  useEffect(() => {
    if (data?.meta?.monthKey && !compareMonthKey) {
      setCompareMonthKey(data.meta.monthKey);
    }
  }, [data, compareMonthKey]);

  const submitAnalysis = async (event) => {
    if (event?.preventDefault) event.preventDefault();
    if (!file) return;

    if (analyzeAbortRef.current) {
      analyzeAbortRef.current.abort();
    }
    const controller = new AbortController();
    analyzeAbortRef.current = controller;
    const requestId = ++analyzeRequestIdRef.current;

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("alert_threshold", threshold);
      formData.append("mode", mode);
      if (monthKey) formData.append("month_key", monthKey);
      if (compareEnabled && !isSameComparator && compareMode) {
        formData.append("compare_mode", compareMode);
      }
      if (compareEnabled && !isSameComparator && compareMonthKey) {
        formData.append("compare_month_key", compareMonthKey);
      }
      if (search) formData.append("search", search);
      if (location) formData.append("location", location);
      if (impactMin !== "") formData.append("impact_min", impactMin);
      if (impactMax !== "") formData.append("impact_max", impactMax);
      if (varMin !== "") formData.append("var_min", varMin);
      if (varMax !== "") formData.append("var_max", varMax);
      formData.append("persist_threshold", persistThreshold);
      formData.append("recovery_threshold", recoveryThreshold);
      formData.append("churn_months", churnMonths);

      const response = await fetch(`${API_BASE}/api/analyze`, {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      if (!response.ok) {
        let message = "Error al analizar el archivo.";
        try {
          const err = await response.json();
          message = err.detail || message;
        } catch {
          const text = await response.text();
          if (text) message = text;
        }
        throw new Error(message);
      }

      let json;
      try {
        json = await response.json();
      } catch {
        throw new Error("Respuesta inválida del servidor.");
      }

      if (requestId === analyzeRequestIdRef.current) {
        setData(json);
      }
    } catch (err) {
      if (err?.name === "AbortError") {
        return;
      }
      setError(err.message);
    } finally {
      if (requestId === analyzeRequestIdRef.current) {
        setLoading(false);
      }
    }
  };

  const handleAnalyze = (event) => submitAnalysis(event);

  const submitNetSuiteAnalysis = async (event) => {
    if (event?.preventDefault) event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("alert_threshold", threshold);
      formData.append("mode", mode);
      if (monthKey) formData.append("month_key", monthKey);
      if (compareEnabled && !isSameComparator && compareMode) {
        formData.append("compare_mode", compareMode);
      }
      if (compareEnabled && !isSameComparator && compareMonthKey) {
        formData.append("compare_month_key", compareMonthKey);
      }
      if (search) formData.append("search", search);
      if (location) formData.append("location", location);
      if (impactMin !== "") formData.append("impact_min", impactMin);
      if (impactMax !== "") formData.append("impact_max", impactMax);
      if (varMin !== "") formData.append("var_min", varMin);
      if (varMax !== "") formData.append("var_max", varMax);
      formData.append("persist_threshold", persistThreshold);
      formData.append("recovery_threshold", recoveryThreshold);

      const response = await fetch(`${API_BASE}/api/analyze/netsuite`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        let message = "Error al analizar desde NetSuite.";
        try {
          const err = await response.json();
          message = err.detail || message;
        } catch {
          const text = await response.text();
          if (text) message = text;
        }
        throw new Error(message);
      }

      let json;
      try {
        json = await response.json();
      } catch {
        throw new Error("Respuesta inválida del servidor.");
      }
      setData(json);
      // Limpiar el archivo actual ya que ahora estamos usando NetSuite
      setFile(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!data || !file) return;
    const timer = setTimeout(() => {
      submitAnalysis();
    }, 450);
    return () => clearTimeout(timer);
  }, [search, location, impactMin, impactMax, varMin, varMax, persistThreshold, recoveryThreshold, churnMonths]);

  const handleDownload = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("alert_threshold", threshold);
      formData.append("mode", mode);
      if (monthKey) formData.append("month_key", monthKey);
      if (search) formData.append("search", search);
      if (location) formData.append("location", location);
      if (impactMin !== "") formData.append("impact_min", impactMin);
      if (impactMax !== "") formData.append("impact_max", impactMax);
      if (varMin !== "") formData.append("var_min", varMin);
      if (varMax !== "") formData.append("var_max", varMax);
      formData.append("persist_threshold", persistThreshold);
      formData.append("recovery_threshold", recoveryThreshold);
      if (compareEnabled && data?.compare && !isSameComparator) {
        const exportModes = [
          { mode, monthKey, label: "Principal" },
          { mode: compareMode, monthKey: compareMonthKey, label: "Comparador" },
        ];
        formData.append("export_modes", JSON.stringify(exportModes));
      }

      const response = await fetch(`${API_BASE}/api/report/excel`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        let message = "Error al generar el Excel.";
        try {
          const err = await response.json();
          message = err.detail || message;
        } catch {
          const text = await response.text();
          if (text) message = text;
        }
        throw new Error(message);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Early_Warning_YoY.xlsx";
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };


  const handleExportCurrentViewPdf = async () => {
    if (!dashboardRef.current) return;
    setPdfLoading(true);
    setError(null);

    try {
      const target = dashboardRef.current;
      const canvas = await html2canvas(target, {
        scale: Math.min(window.devicePixelRatio || 1, 2),
        useCORS: true,
        backgroundColor: "#f6f0e8",
        logging: false,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const margin = 8;
      const renderWidth = pdfWidth - margin * 2;
      const renderHeight = (canvas.height * renderWidth) / canvas.width;

      let heightLeft = renderHeight;
      let position = margin;

      pdf.addImage(imgData, "PNG", margin, position, renderWidth, renderHeight);
      heightLeft -= (pdfHeight - margin * 2);

      while (heightLeft > 0) {
        pdf.addPage();
        position = margin - (renderHeight - heightLeft);
        pdf.addImage(imgData, "PNG", margin, position, renderWidth, renderHeight);
        heightLeft -= (pdfHeight - margin * 2);
      }

      const periodLabel = data?.meta?.latestLabel || "current";
      const safeLabel = String(periodLabel).replace(/\s+/g, "_").replace(/[^\w-]/g, "");
      pdf.save(`Executive_YoY_BE_Control_${safeLabel}.pdf`);
    } catch (err) {
      setError(err?.message || "No se pudo exportar el PDF de la vista actual.");
    } finally {
      setPdfLoading(false);
    }
  };


  useEffect(() => {
    return () => {
      if (analyzeAbortRef.current) {
        analyzeAbortRef.current.abort();
      }
    };
  }, []);

  const isSameComparator =
    data &&
    compareMode === data.meta?.mode &&
    (compareMonthKey || "") === (data.meta?.monthKey || "");

  useEffect(() => {
    const saved = localStorage.getItem("early_warning_prefs");
    if (!saved) return;
    try {
      const prefs = JSON.parse(saved);
      if (prefs.mode) setMode(prefs.mode);
      if (prefs.monthKey) setMonthKey(prefs.monthKey);
      if (prefs.compareMode) setCompareMode(prefs.compareMode);
      if (prefs.compareMonthKey) setCompareMonthKey(prefs.compareMonthKey);
      if (prefs.threshold !== undefined) setThreshold(prefs.threshold);
      if (prefs.persistThreshold !== undefined) setPersistThreshold(prefs.persistThreshold);
      if (prefs.recoveryThreshold !== undefined) setRecoveryThreshold(prefs.recoveryThreshold);
      if (prefs.compareEnabled !== undefined) setCompareEnabled(prefs.compareEnabled);
      if (prefs.search !== undefined) setSearch(prefs.search);
      if (prefs.location !== undefined) setLocation(prefs.location);
      if (prefs.impactMin !== undefined) setImpactMin(prefs.impactMin);
      if (prefs.impactMax !== undefined) setImpactMax(prefs.impactMax);
      if (prefs.varMin !== undefined) setVarMin(prefs.varMin);
      if (prefs.varMax !== undefined) setVarMax(prefs.varMax);
    } catch {
      // ignore bad prefs
    }
  }, []);

  useEffect(() => {
    const prefs = {
      mode,
      monthKey,
      compareMode,
      compareMonthKey,
      compareEnabled,
      threshold,
      persistThreshold,
      recoveryThreshold,
      churnMonths,
      cohortMetric,
      search,
      location,
      impactMin,
      impactMax,
      varMin,
      varMax,
    };
    localStorage.setItem("early_warning_prefs", JSON.stringify(prefs));
  }, [
    mode,
    monthKey,
    compareMode,
    compareMonthKey,
    compareEnabled,
    threshold,
    persistThreshold,
    recoveryThreshold,
    churnMonths,
    cohortMetric,
    search,
    location,
    impactMin,
    impactMax,
    varMin,
    varMax,
  ]);

  return (
    <div className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">Early Warning System</p>
          <h1>Executive YoY BE Control</h1>
          <p className="lead">
            Sube tu Excel y detecta caídas, crecimientos, hoteles nuevos y perdidos con un
            resumen listo para imprimir.
          </p>
        </div>
        <div className="hero-card">
          <form onSubmit={handleAnalyze}>
            <div className="hero-top-layout">
              <section className="hero-upload-panel">
                <div
                  className={`file-dropzone hero-dropzone${isFileDragOver ? " is-over" : ""}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsFileDragOver(true);
                  }}
                  onDragLeave={() => setIsFileDragOver(false)}
                  onDrop={handleDropFile}
                >
                  <div className="hero-upload-title">Subida de archivo</div>
                  <p className="hero-upload-note">Arrastra tu Excel (.xls, .xlsx) o selecciónalo manualmente.</p>
                  <label className="file">
                    <span>Archivo fuente</span>
                    <input
                      type="file"
                      accept=".xls,.xlsx"
                      onChange={(e) => setFile(e.target.files[0])}
                    />
                  </label>
                  <span className="file-name hero-file-pill">
                    {file ? `Cargado: ${file.name}` : "Ningún archivo seleccionado"}
                  </span>
                </div>

                <div className="hero-actions">
                  <button type="submit" disabled={!file || loading}>
                    {loading ? "Analizando..." : "Analizar"}
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={handleDownload}
                    disabled={!file || loading}
                  >
                    Excel
                  </button>
                  <button
                    type="button"
                    className="ghost"
                    onClick={handleExportCurrentViewPdf}
                    disabled={!data || pdfLoading}
                  >
                    {pdfLoading ? "Generando PDF..." : "PDF"}
                  </button>
                  <button
                    type="button"
                    className="tertiary"
                    disabled={true}
                    title="Obtener datos directamente desde NetSuite"
                  >
                    Analizar desde NetSuite
                  </button>
                </div>
              </section>

              <section className="hero-controls-panel">
                <div className="hero-params-grid">
                  <label className="threshold">
                    <span>
                      Modo de análisis{" "}
                      <span
                        className="help"
                        title="Mes: compara un mes con su mismo mes del año anterior. YTD: enero-hasta el mes elegido vs año anterior. Rolling: últimos 3/6 meses vs mismos meses del año anterior."
                      >
                        ?
                      </span>
                    </span>
                    <select value={mode} onChange={(e) => setMode(e.target.value)}>
                      <option value="month">Último mes</option>
                      <option value="ytd">YTD (año a la fecha)</option>
                      <option value="rolling3">Rolling 3 meses</option>
                      <option value="rolling6">Rolling 6 meses</option>
                    </select>
                  </label>

                  <label className="threshold">
                    <span>Mes de referencia</span>
                    <select
                      value={monthKey ?? ""}
                      onChange={(e) => setMonthKey(e.target.value || null)}
                      disabled={!data?.meta?.availableMonths?.length}
                    >
                      {!data?.meta?.availableMonths?.length && (
                        <option value="">Analiza primero</option>
                      )}
                      {data?.meta?.availableMonths?.map((m) => (
                        <option key={m.key} value={m.key}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="threshold">
                    <span>
                      Comparador: modo{" "}
                      <span
                        className="help"
                        title="El comparador sirve para contrastar otro periodo (modo/mes) con el principal."
                      >
                        ?
                      </span>
                    </span>
                    <select value={compareMode} onChange={(e) => setCompareMode(e.target.value)}>
                      <option value="month">Último mes</option>
                      <option value="ytd">YTD (año a la fecha)</option>
                      <option value="rolling3">Rolling 3 meses</option>
                      <option value="rolling6">Rolling 6 meses</option>
                    </select>
                  </label>

                  <label className="threshold">
                    <span>Comparador: mes</span>
                    <select
                      value={compareMonthKey ?? ""}
                      onChange={(e) => setCompareMonthKey(e.target.value || null)}
                      disabled={!data?.meta?.availableMonths?.length}
                    >
                      {!data?.meta?.availableMonths?.length && (
                        <option value="">Analiza primero</option>
                      )}
                      {data?.meta?.availableMonths?.map((m) => (
                        <option key={m.key} value={m.key}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="threshold">
                    <span>Umbral de alerta (%)</span>
                    <input
                      type="number"
                      value={threshold}
                      onChange={(e) => setThreshold(Number(e.target.value))}
                    />
                  </label>

                  <div className="threshold">
                    <span>Comparador</span>
                    <div className="toggle-label-inline">
                      <label className="toggle">
                        <input
                          type="checkbox"
                          checked={compareEnabled}
                          onChange={(e) => setCompareEnabled(e.target.checked)}
                        />
                        <span className="toggle-track" />
                      </label>
                      <strong>{compareEnabled ? "Activo" : "Desactivado"}</strong>
                    </div>
                  </div>
                </div>

                {compareEnabled && isSameComparator && (
                  <p className="warning">
                    El comparador coincide con el periodo principal. Cambia modo o mes para activarlo.
                  </p>
                )}
              </section>
            </div>
          </form>
          {error && <p className="error">{error}</p>}
          {loading && (
            <div className="loading-overlay">
              <div className="loading-card">
                <div className="loading-ring"></div>
                <div className="loading-icon">
                  <svg viewBox="0 0 64 64" aria-hidden="true">
                    <rect x="18" y="16" width="28" height="34" rx="2" fill="#516BA6" />
                    <rect x="24" y="22" width="6" height="6" fill="#F6EFE6" />
                    <rect x="34" y="22" width="6" height="6" fill="#F6EFE6" />
                    <rect x="24" y="32" width="6" height="6" fill="#F6EFE6" />
                    <rect x="34" y="32" width="6" height="6" fill="#F6EFE6" />
                    <rect x="29" y="42" width="6" height="8" fill="#F6EFE6" />
                  </svg>
                </div>
                <p>Procesando datos…</p>
              </div>
            </div>
          )}
        </div>
      </header>

      {data && (
        <main className="content" ref={dashboardRef}>
          <DraggableBlock id="filters" order={getPanelOrder("filters")} dragId={dragPanelId} onDragStart={handlePanelDragStart} onDragOver={handlePanelDragOver} onDrop={handlePanelDrop}>
          <section className="panel filters">
            <div className="panel-head">
              <h3>Filtros</h3>
              <div className="actions">
                <button
                  type="button"
                  className="ghost small"
                  onClick={() => {
                    setSearch("");
                    setLocation("all");
                    setImpactMin("");
                    setImpactMax("");
                    setVarMin("");
                    setVarMax("");
                  }}
                >
                  Limpiar filtros
                </button>
                <button
                  type="button"
                  className="ghost small"
                  onClick={() => setShowFilters((prev) => !prev)}
                >
                  {showFilters ? "Ocultar" : "Mostrar"}
                </button>
              </div>
            </div>
            {showFilters && (
            <div className="filter-grid">
              <label>
                <span>Búsqueda hotel / code</span>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Ej: Melia, BCN..."
                />
              </label>
              <label>
                <span>Ubicación</span>
                <select value={location} onChange={(e) => setLocation(e.target.value)}>
                  <option value="all">Todas</option>
                  {locations.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Impacto € mínimo</span>
                <input
                  type="number"
                  value={impactMin}
                  onChange={(e) => setImpactMin(e.target.value)}
                  placeholder="0"
                />
              </label>
              <label>
                <span>Impacto € máximo</span>
                <input
                  type="number"
                  value={impactMax}
                  onChange={(e) => setImpactMax(e.target.value)}
                  placeholder="100000"
                />
              </label>
              <label>
                <span>Variación % mínima</span>
                <input
                  type="number"
                  value={varMin}
                  onChange={(e) => setVarMin(e.target.value)}
                  placeholder="-50"
                />
              </label>
              <label>
                <span>Variación % máxima</span>
                <input
                  type="number"
                  value={varMax}
                  onChange={(e) => setVarMax(e.target.value)}
                  placeholder="50"
                />
              </label>
              <label>
                <span>Alerta persistente (%)</span>
                <input
                  type="number"
                  value={persistThreshold}
                  onChange={(e) => setPersistThreshold(Number(e.target.value))}
                  placeholder="-30"
                />
              </label>
              <label>
                <span>Recuperación desde (%)</span>
                <input
                  type="number"
                  value={recoveryThreshold}
                  onChange={(e) => setRecoveryThreshold(Number(e.target.value))}
                  placeholder="0"
                />
              </label>
              <label>
                <span>Churn (meses sin ventas)</span>
                <select value={churnMonths} onChange={(e) => setChurnMonths(Number(e.target.value))}>
                  <option value="6">6</option>
                  <option value="9">9</option>
                  <option value="12">12</option>
                </select>
              </label>
            </div>
            )}
          </section>
          </DraggableBlock>

          <DraggableBlock id="summary-main" order={getPanelOrder("summary-main")} dragId={dragPanelId} onDragStart={handlePanelDragStart} onDragOver={handlePanelDragOver} onDrop={handlePanelDrop}>
          <section className="panel summary">
            <div className="panel-head">
              <h3>Comparativa principal</h3>
              <button
                type="button"
                className="ghost small"
                onClick={() => setShowMainSummary((prev) => !prev)}
              >
                {showMainSummary ? "Ocultar" : "Mostrar"}
              </button>
            </div>
            {showMainSummary && (
            <>
              <p className="muted">Comparativa principal</p>
              <h2>{data.meta.periodLabel || data.meta.pairLabel}</h2>
              <p className="tag">{data.meta.mode?.toUpperCase()} · {data.meta.monthKey}</p>
            <div className="summary-grid">
              <div>
                <span>Facturación año anterior</span>
                <strong>{currency(data.summary.totalPrev)}</strong>
              </div>
              <div>
                <span>Facturación año actual</span>
                <strong>{currency(data.summary.totalCurr)}</strong>
              </div>
              <div>
                <span>Variación absoluta</span>
                <strong>{currency(data.summary.totalVar)}</strong>
              </div>
              <div>
                <span>Variación %</span>
                <strong>{percent(data.summary.totalVarPct)}</strong>
              </div>
              <div>
                <span>Alertas</span>
                <strong>{data.summary.alertsCount}</strong>
                <small>{currency(data.summary.alertsImpact)} impacto</small>
              </div>
              <div>
                <span>Crecimientos</span>
                <strong>{data.summary.growthCount}</strong>
                <small>{currency(data.summary.growthImpact)} impacto</small>
              </div>
              <div>
                <span>Hoteles nuevos</span>
                <strong>{data.summary.newCount}</strong>
                <small>{currency(data.summary.newRevenue)} facturación</small>
              </div>
              <div>
                <span>Hoteles perdidos</span>
                <strong>{data.summary.lostCount}</strong>
                <small>{currency(data.summary.lostRevenue)} perdida</small>
              </div>
            </div>
            </>
            )}
          </section>
          </DraggableBlock>

          {data.aiSummary && (
            <DraggableBlock id="summary-ai" order={getPanelOrder("summary-ai")} dragId={dragPanelId} onDragStart={handlePanelDragStart} onDragOver={handlePanelDragOver} onDrop={handlePanelDrop}>
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h3>Resumen inteligente</h3>
                  <p className="muted">Conclusiones ejecutivas automáticas del periodo.</p>
                  <p className="tag">Fuente: {data.aiSummary.source === "gemini" ? "Gemini" : "Fallback heurístico"}</p>
                  {data.aiSummary.source !== "gemini" && data.aiSummary.llmFallbackReason && (
                    <p className="muted">Gemini no disponible: {data.aiSummary.llmFallbackReason}</p>
                  )}
                </div>
                <button
                  type="button"
                  className="ghost small"
                  onClick={() => setShowAiSummary((prev) => !prev)}
                >
                  {showAiSummary ? "Ocultar" : "Mostrar"}
                </button>
              </div>
              {showAiSummary && (
              <div className="grid">
                <div className="chart">
                  <h4>Conclusiones</h4>
                  <ul>
                    {(data.aiSummary.conclusions || []).map((item, idx) => (
                      <li key={`c-${idx}`}>{normalizeThousandsInText(item)}</li>
                    ))}
                  </ul>
                </div>
                <div className="chart">
                  <h4>Observaciones</h4>
                  <ul>
                    {(data.aiSummary.observations || []).map((item, idx) => (
                      <li key={`o-${idx}`}>{normalizeThousandsInText(item)}</li>
                    ))}
                  </ul>
                </div>
                <div className="chart">
                  <h4>Riesgos clave</h4>
                  <ul>
                    {(data.aiSummary.risks || []).map((item, idx) => (
                      <li key={`r-${idx}`}>{normalizeThousandsInText(item)}</li>
                    ))}
                  </ul>
                </div>
                <div className="chart">
                  <h4>Oportunidades</h4>
                  <ul>
                    {(data.aiSummary.opportunities || []).map((item, idx) => (
                      <li key={`op-${idx}`}>{normalizeThousandsInText(item)}</li>
                    ))}
                  </ul>
                </div>
                <div className="chart">
                  <h4>Acciones sugeridas</h4>
                  <ul>
                    {(data.aiSummary.actions || []).map((item, idx) => (
                      <li key={`a-${idx}`}>{normalizeThousandsInText(item)}</li>
                    ))}
                  </ul>
                </div>
              </div>
              )}
            </section>
            </DraggableBlock>
          )}

          {compareEnabled && data.compare && !isSameComparator && (
            <DraggableBlock id="summary-compare" order={getPanelOrder("summary-compare")} dragId={dragPanelId} onDragStart={handlePanelDragStart} onDragOver={handlePanelDragOver} onDrop={handlePanelDrop}>
            <section className="panel summary">
              <div className="panel-head">
                <h3>Comparador de periodos</h3>
                <button
                  type="button"
                  className="ghost small"
                  onClick={() => setShowCompareSummary((prev) => !prev)}
                >
                  {showCompareSummary ? "Ocultar" : "Mostrar"}
                </button>
              </div>
              {showCompareSummary && (
              <>
              <div>
                <p className="muted">Comparador de periodos</p>
                <h2>{data.compare.meta.periodLabel || data.compare.meta.pairLabel}</h2>
                <p className="tag">{data.compare.meta.mode?.toUpperCase()} · {data.compare.meta.monthKey}</p>
              </div>
              <div className="summary-grid">
                <div>
                  <span>Facturación año anterior</span>
                  <strong>{currency(data.compare.summary.totalPrev)}</strong>
                </div>
                <div>
                  <span>Facturación año actual</span>
                  <strong>{currency(data.compare.summary.totalCurr)}</strong>
                </div>
                <div>
                  <span>Variación absoluta</span>
                  <strong>{currency(data.compare.summary.totalVar)}</strong>
                </div>
                <div>
                  <span>Variación %</span>
                  <strong>{percent(data.compare.summary.totalVarPct)}</strong>
                </div>
                <div>
                  <span>Alertas</span>
                  <strong>{data.compare.summary.alertsCount}</strong>
                  <small>{currency(data.compare.summary.alertsImpact)} impacto</small>
                </div>
                <div>
                  <span>Crecimientos</span>
                  <strong>{data.compare.summary.growthCount}</strong>
                  <small>{currency(data.compare.summary.growthImpact)} impacto</small>
                </div>
                <div>
                  <span>Hoteles nuevos</span>
                  <strong>{data.compare.summary.newCount}</strong>
                  <small>{currency(data.compare.summary.newRevenue)} facturación</small>
                </div>
                <div>
                  <span>Hoteles perdidos</span>
                  <strong>{data.compare.summary.lostCount}</strong>
                  <small>{currency(data.compare.summary.lostRevenue)} perdida</small>
                </div>
              </div>
              </>
              )}
            </section>
            </DraggableBlock>
          )}
          <DraggableBlock id="trend" order={getPanelOrder("trend")} dragId={dragPanelId} onDragStart={handlePanelDragStart} onDragOver={handlePanelDragOver} onDrop={handlePanelDrop}>
          <section className="panel">
            <div className="panel-head">
              <div>
                <h3>Tendencia YoY total</h3>
                <p className="muted">Variación % mensual con comparación YoY.</p>
              </div>
              <button
                type="button"
                className="ghost small"
                onClick={() => setShowCharts((prev) => !prev)}
              >
                {showCharts ? "Ocultar" : "Mostrar"}
              </button>
            </div>
            {showCharts && (
              <div className="chart">
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={data.series}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1e5d8" />
                    <XAxis dataKey="label" />
                    <YAxis tickFormatter={(v) => `${v}%`} />
                    <Tooltip formatter={(v) => percent(v)} />
                    <Line type="monotone" dataKey="varPct" stroke="#c94b2a" strokeWidth={3} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>
          </DraggableBlock>

          <DraggableBlock id="top-impact" order={getPanelOrder("top-impact")} dragId={dragPanelId} onDragStart={handlePanelDragStart} onDragOver={handlePanelDragOver} onDrop={handlePanelDrop}>
          <section className="panel">
            <div className="panel-head">
              <div>
                <h3>Impacto Top 10</h3>
                <p className="muted">Alertas y crecimientos más relevantes.</p>
              </div>
              <button
                type="button"
                className="ghost small"
                onClick={() => setShowTopImpact((prev) => !prev)}
              >
                {showTopImpact ? "Ocultar" : "Mostrar"}
              </button>
            </div>
            {showTopImpact && (
              <div className="grid">
                <div className="chart">
                  <h4>Alertas</h4>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart
                      data={topAlerts10.map((row) => ({
                        name: row.Cliente?.slice(0, 20) || "-",
                        impact: Math.abs(row.VarAbs || 0),
                      }))}
                      layout="vertical"
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1e5d8" />
                      <XAxis type="number" tickFormatter={(v) => currency(v)} />
                      <YAxis type="category" dataKey="name" width={100} />
                      <Tooltip formatter={(v) => currency(v)} />
                      <Bar dataKey="impact" fill="#c94b2a" radius={[8, 8, 8, 8]} />
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="spark-grid">
                    {topAlerts10.map((row) => (
                      <div key={row.Cliente} className="spark-row">
                        <p className="spark-name">{row.Cliente}</p>
                        <small className="muted">YoY %</small>
                        <Sparkline data={data.hotelSeries?.alerts?.[row.Cliente]} metric="pct" />
                        <small className="muted">Facturación</small>
                        <Sparkline data={data.hotelSeries?.alerts?.[row.Cliente]} metric="curr" />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="chart">
                  <h4>Crecimientos</h4>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart
                      data={topGrowth10.map((row) => ({
                        name: row.Cliente?.slice(0, 20) || "-",
                        impact: row.VarAbs || 0,
                      }))}
                      layout="vertical"
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1e5d8" />
                      <XAxis type="number" tickFormatter={(v) => currency(v)} />
                      <YAxis type="category" dataKey="name" width={100} />
                      <Tooltip formatter={(v) => currency(v)} />
                      <Bar dataKey="impact" fill="#0f6b6e" radius={[8, 8, 8, 8]} />
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="spark-grid">
                    {topGrowth10.map((row) => (
                      <div key={row.Cliente} className="spark-row">
                        <p className="spark-name">{row.Cliente}</p>
                        <small className="muted">YoY %</small>
                        <Sparkline data={data.hotelSeries?.growth?.[row.Cliente]} metric="pct" />
                        <small className="muted">Facturación</small>
                        <Sparkline data={data.hotelSeries?.growth?.[row.Cliente]} metric="curr" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>
          </DraggableBlock>

          <DraggableBlock id="smart-alerts" order={getPanelOrder("smart-alerts")} dragId={dragPanelId} onDragStart={handlePanelDragStart} onDragOver={handlePanelDragOver} onDrop={handlePanelDrop}>
          <section className="panel">
            <div className="panel-head">
              <div>
                <h3>Alertas inteligentes</h3>
                <p className="muted">Persistentes y recuperaciones detectadas automáticamente.</p>
              </div>
              <button
                type="button"
                className="ghost small"
                onClick={() => setShowSmartAlerts((prev) => !prev)}
              >
                {showSmartAlerts ? "Ocultar" : "Mostrar"}
              </button>
            </div>
            {showSmartAlerts && (
              <div className="grid">
                <div className="chart">
                  <h4>Persistentes (2 meses seguidos)</h4>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Hotel</th>
                          <th>Ubicación</th>
                          <th>Mes actual</th>
                          <th>Mes previo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(data.intelligentAlerts?.persistent ?? []).slice(0, 10).map((row, idx) => (
                          <tr
                            key={`${row.Cliente}-${idx}`}
                            className="row-clickable"
                            onClick={() => applyFiltersAndReload({ search: row.Cliente })}
                          >
                            <td>{row.Cliente}</td>
                            <td>{row.Ubicacion ?? "—"}</td>
                            <td>{percent(row.VarPctLast)}</td>
                            <td>{percent(row.VarPctPrev)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="chart">
                  <h4>Recuperación</h4>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Hotel</th>
                          <th>Ubicación</th>
                          <th>Mes actual</th>
                          <th>Mes previo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(data.intelligentAlerts?.recovery ?? []).slice(0, 10).map((row, idx) => (
                          <tr
                            key={`${row.Cliente}-${idx}`}
                            className="row-clickable"
                            onClick={() => applyFiltersAndReload({ search: row.Cliente })}
                          >
                            <td>{row.Cliente}</td>
                            <td>{row.Ubicacion ?? "—"}</td>
                            <td>{percent(row.VarPctLast)}</td>
                            <td>{percent(row.VarPctPrev)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </section>
          </DraggableBlock>

          <DraggableBlock id="table-alerts" className="half" order={getPanelOrder("table-alerts")} dragId={dragPanelId} onDragStart={handlePanelDragStart} onDragOver={handlePanelDragOver} onDrop={handlePanelDrop}>
            <Table title="Alertas" rows={data.tables.alerts} columns={columnDefs} onRowClick={(row) => applyFiltersAndReload({ search: row.Cliente })} />
          </DraggableBlock>

          <DraggableBlock id="table-growth" className="half" order={getPanelOrder("table-growth")} dragId={dragPanelId} onDragStart={handlePanelDragStart} onDragOver={handlePanelDragOver} onDrop={handlePanelDrop}>
            <Table title="Crecimientos" rows={data.tables.growth} columns={columnDefs} onRowClick={(row) => applyFiltersAndReload({ search: row.Cliente })} />
          </DraggableBlock>

          <DraggableBlock id="table-new" className="half" order={getPanelOrder("table-new")} dragId={dragPanelId} onDragStart={handlePanelDragStart} onDragOver={handlePanelDragOver} onDrop={handlePanelDrop}>
            <Table title="Hoteles nuevos" rows={data.tables.new} columns={columnDefs} onRowClick={(row) => applyFiltersAndReload({ search: row.Cliente })} />
          </DraggableBlock>

          <DraggableBlock id="table-lost" className="half" order={getPanelOrder("table-lost")} dragId={dragPanelId} onDragStart={handlePanelDragStart} onDragOver={handlePanelDragOver} onDrop={handlePanelDrop}>
            <Table title="Hoteles perdidos" rows={data.tables.lost} columns={columnDefs} onRowClick={(row) => applyFiltersAndReload({ search: row.Cliente })} />
          </DraggableBlock>

          <DraggableBlock id="clusters" order={getPanelOrder("clusters")} dragId={dragPanelId} onDragStart={handlePanelDragStart} onDragOver={handlePanelDragOver} onDrop={handlePanelDrop}>
          <section className="panel">
            <div className="panel-head">
              <div>
                <h3>Consolidación por cluster</h3>
              </div>
              <button type="button" className="ghost small" onClick={() => setShowClusters((prev) => !prev)}>{showClusters ? "Ocultar" : "Mostrar"}</button>
            </div>
            {showClusters && (
            <div className="grid">
              <Table
                title="Por cluster"
                rows={data.clusters?.byCluster || []}
                columns={[
                  { key: 'Cluster', label: 'Cluster', render: (row) => row.Cluster },
                  { key: 'Prev', label: data.meta.previousLabel, render: (row) => currency(row.Prev) },
                  { key: 'Curr', label: data.meta.latestLabel, render: (row) => currency(row.Curr) },
                  { key: 'VarAbs', label: 'Variación €', render: (row) => currency(row.VarAbs) },
                  { key: 'VarPct', label: 'Variación %', render: (row) => percent(row.VarPct) },
                ]}
                onRowClick={(row) => applyFiltersAndReload({ search: row.Cluster })}
              />
              {data.clusters?.byCountry?.length > 0 && (
                <Table
                  title="Por país"
                  rows={data.clusters.byCountry}
                  columns={[
                    { key: 'Country', label: 'País', render: (row) => row.Country },
                    { key: 'Prev', label: data.meta.previousLabel, render: (row) => currency(row.Prev) },
                    { key: 'Curr', label: data.meta.latestLabel, render: (row) => currency(row.Curr) },
                    { key: 'VarAbs', label: 'Variación €', render: (row) => currency(row.VarAbs) },
                    { key: 'VarPct', label: 'Variación %', render: (row) => percent(row.VarPct) },
                  ]}
                />
              )}
            </div>
            )}
          </section>
          </DraggableBlock>


          <DraggableBlock id="churn" order={getPanelOrder("churn")} dragId={dragPanelId} onDragStart={handlePanelDragStart} onDragOver={handlePanelDragOver} onDrop={handlePanelDrop}>
          <section className="panel">
            <div className="panel-head">
              <div>
                <h3>Churn</h3>
                <p className="muted">Hoteles sin ventas durante {churnMonths} meses o más.</p>
              </div>
              <button type="button" className="ghost small" onClick={() => setShowChurn((prev) => !prev)}>{showChurn ? "Ocultar" : "Mostrar"}</button>
            </div>
            {showChurn && (
            <Table
              title="Hoteles en churn"
              rows={(data.churn || []).sort((a, b) => (b.MonthsInactive || 0) - (a.MonthsInactive || 0))}
              columns={[
                { key: 'Cliente', label: 'Hotel', render: (row) => row.Cliente },
                { key: 'Ubicacion', label: 'Ubicación', render: (row) => row.Ubicacion ?? '—' },
                { key: 'MonthsInactive', label: 'Meses sin ventas', render: (row) => integer(row.MonthsInactive) },
              ]}
              onRowClick={(row) => applyFiltersAndReload({ search: row.Cliente })}
            />
            )}
          </section>
          </DraggableBlock>

          <DraggableBlock id="cohorts" order={getPanelOrder("cohorts")} dragId={dragPanelId} onDragStart={handlePanelDragStart} onDragOver={handlePanelDragOver} onDrop={handlePanelDrop}>
          <section className="panel">
            <div className="panel-head">
              <div>
                <h3>Cohortes</h3>
                <p className="muted">Tipos comunes: adquisición, comportamiento y predictivas.</p>
              </div>
              <div className="actions">
                <button type="button" className="ghost small" onClick={() => setShowCohorts((prev) => !prev)}>{showCohorts ? "Ocultar" : "Mostrar"}</button>
              <div className="cohort-controls">
                <label>
                  <span>Vista</span>
                  <select value={cohortMetric} onChange={(e) => setCohortMetric(e.target.value)}>
                    <option value="active">% hoteles activos</option>
                    <option value="revenue">% facturación retenida</option>
                  </select>
                </label>
              </div>
              </div>
            </div>
            {showCohorts && (
            <div className="table-wrap">
              <table className="cohort-table">
                <thead>
                  <tr>
                    <th>Cohorte</th>
                    <th>Tamaño</th>
                    {(data.cohorts?.columns || []).map((col) => (
                      <th key={col}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(data.cohorts?.rows || []).map((row) => (
                    <tr key={row.cohort}>
                      <td>{row.cohort}</td>
                      <td>{integer(row.size)}</td>
                      {(data.cohorts?.columns || []).map((_, idx) => {
                        const values = cohortMetric === 'active' ? row.active : row.revenue;
                        const value = values ? values[idx] : null;
                        return (
                          <td
                            key={idx}
                            style={{ backgroundColor: heatColor(value), color: value && value > 60 ? '#fff' : '#1b1b1f' }}
                          >
                            {value === null ? '—' : `${value}%`}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
          </section>
          </DraggableBlock>

          <DraggableBlock id="distribution" order={getPanelOrder("distribution")} dragId={dragPanelId} onDragStart={handlePanelDragStart} onDragOver={handlePanelDragOver} onDrop={handlePanelDrop}>
          <section className="panel">
            <div className="panel-head">
              <div>
                <h3>Distribución por ubicación y país</h3>
              </div>
              <button type="button" className="ghost small" onClick={() => setShowDistribution((prev) => !prev)}>{showDistribution ? "Ocultar" : "Mostrar"}</button>
            </div>
            {showDistribution && (
            <div className="grid">
              <div className="chart">
                <h4>Ubicación</h4>
                <ResponsiveContainer width="100%" height={340}>
                  <PieChart>
                    <Pie
                      data={locationPieView}
                      dataKey="value"
                      nameKey="label"
                      innerRadius={72}
                      outerRadius={132}
                      paddingAngle={2}
                      label={false}
                      labelLine={false}
                      onClick={(entry) => applyFiltersAndReload({ location: entry?.filterValue || "all" })}
                    >
                      {locationPieView.map((entry, idx) => (
                        <Cell key={`loc-${entry.name}-${idx}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => currency(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pie-legend">
                  {locationPieView.map((row) => (
                    <button
                      key={`loc-legend-${row.name}`}
                      type="button"
                      className="pie-legend-item"
                      onClick={() => applyFiltersAndReload({ location: row.filterValue || "all" })}
                    >
                      <span className="dot" style={{ backgroundColor: row.color }} />
                      <span className="pie-legend-label">{row.label}</span>
                      <span className="pie-legend-pct">{row.pct.toFixed(1)}%</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="chart">
                <h4>País</h4>
                <ResponsiveContainer width="100%" height={340}>
                  <PieChart>
                    <Pie
                      data={countryPieView}
                      dataKey="value"
                      nameKey="label"
                      innerRadius={72}
                      outerRadius={132}
                      paddingAngle={2}
                      label={false}
                      labelLine={false}
                      onClick={(entry) => applyFiltersAndReload({ search: entry?.filterValue || "" })}
                    >
                      {countryPieView.map((entry, idx) => (
                        <Cell key={`country-${entry.name}-${idx}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => currency(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pie-legend">
                  {countryPieView.map((row) => (
                    <button
                      key={`country-legend-${row.name}`}
                      type="button"
                      className="pie-legend-item"
                      onClick={() => applyFiltersAndReload({ search: row.filterValue || "" })}
                    >
                      <span className="dot" style={{ backgroundColor: row.color }} />
                      <span className="pie-legend-label">{row.label}</span>
                      <span className="pie-legend-pct">{row.pct.toFixed(1)}%</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            )}
          </section>
          </DraggableBlock>




          <DraggableBlock id="location-analysis" order={getPanelOrder("location-analysis")} dragId={dragPanelId} onDragStart={handlePanelDragStart} onDragOver={handlePanelDragOver} onDrop={handlePanelDrop}>
          <Table
            title="Análisis por ubicación"
            rows={data.tables.locations}
            columns={locationColumns}
            onRowClick={(row) => applyFiltersAndReload({ location: row.Ubicacion, search: "" })}
          />
          </DraggableBlock>
        </main>
      )}
    </div>
  );
}
