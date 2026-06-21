import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";

const FASTAPI_URL = process.env.REACT_APP_FASTAPI || "http://localhost:8000";
const EXPRESS_URL = process.env.REACT_APP_EXPRESS || "http://localhost:5000";

function Badge({ children }) {
  return (
    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 text-pink-400 border border-slate-700">
      {children}
    </span>
  );
}

function ConfidenceBar({ value, color = "pink" }) {
  const colorClass = color === "purple" ? "bg-purple-500" : "bg-pink-500";
  return (
    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
      <div
        className={`h-full ${colorClass} transition-all duration-700 ease-out`}
        style={{ width: `${Math.min(100, Math.max(0, value || 0))}%` }}
      />
    </div>
  );
}

export default function App() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [drag, setDrag] = useState(false);
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState({ total: 0, top_flowers: [] });
  const [error, setError] = useState("");

  const fetchHistory = useCallback(async () => {
    try {
      const res = await axios.get(`${EXPRESS_URL}/api/predictions`);
      setHistory(res.data);
    } catch (err) {
      // History server might not be running yet - non-fatal for the main flow.
      console.warn("Could not fetch history:", err.message);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await axios.get(`${EXPRESS_URL}/api/stats`);
      setStats(res.data);
    } catch (err) {
      console.warn("Could not fetch stats:", err.message);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
    fetchStats();
  }, [fetchHistory, fetchStats]);

  const handleFile = (selected) => {
    if (!selected) return;
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
    setResult(null);
    setError("");
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDrag(false);
    const dropped = e.dataTransfer.files && e.dataTransfer.files[0];
    handleFile(dropped);
  };

  const onIdentify = async () => {
    if (!file) return;
    setLoading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await axios.post(`${FASTAPI_URL}/predict`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setResult(res.data);

      // Save to history - non-blocking, don't fail the prediction if this fails.
      try {
        await axios.post(`${EXPRESS_URL}/api/predictions`, {
          flower_name: res.data.prediction,
          class_id: res.data.class_id,
          confidence: res.data.confidence,
          is_confident: res.data.is_confident,
          image_name: file.name,
          top5: res.data.top5,
        });
        fetchHistory();
        fetchStats();
      } catch (saveErr) {
        console.warn("Could not save prediction history:", saveErr.message);
      }
    } catch (err) {
      setError(
        `Could not reach the FlowerLens backend at ${FASTAPI_URL}. Is the FastAPI server running?`
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800 px-6 py-5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">
              <span className="text-pink-500">Flower</span>
              <span className="text-purple-400">Lens</span>{" "}
              <span className="text-slate-400 text-base font-normal">AI</span>
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Flower species classifier &mdash; transfer-learned EfficientNet-B0
            </p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <Badge>EfficientNet-B0</Badge>
            <Badge>RAG</Badge>
            <Badge>DAG Pipeline</Badge>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-950 text-purple-300 border border-purple-800">
              {stats.total || 0} predictions made
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1: Upload */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-slate-200">Upload an Image</h2>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
            onClick={() => document.getElementById("file-input").click()}
            className={`cursor-pointer rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-center p-6 min-h-[220px] transition-colors ${
              drag ? "border-pink-500 bg-slate-800" : "border-slate-700 bg-slate-950/50"
            }`}
          >
            {preview ? (
              <img src={preview} alt="preview" className="max-h-48 rounded-lg object-contain" />
            ) : (
              <>
                <p className="text-slate-400">Drag &amp; drop a flower photo here</p>
                <p className="text-slate-500 text-sm mt-1">or click to browse</p>
              </>
            )}
            <input
              id="file-input"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFile(e.target.files && e.target.files[0])}
            />
          </div>

          <button
            onClick={onIdentify}
            disabled={!file || loading}
            className="w-full py-2.5 rounded-lg font-semibold bg-gradient-to-r from-pink-500 to-purple-500 disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
          >
            {loading ? "Identifying..." : "Identify Flower"}
          </button>

          {error && (
            <p className="text-sm text-red-400 bg-red-950/40 border border-red-900 rounded-lg p-3">
              {error}
            </p>
          )}

          <div>
            <h3 className="text-sm font-semibold text-slate-400 mb-2">Prediction History</h3>
            <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
              {history.length === 0 && (
                <p className="text-slate-600 text-sm">No predictions yet.</p>
              )}
              {history.map((h, i) => (
                <div
                  key={h._id || i}
                  className="flex items-center justify-between bg-slate-800/60 rounded-lg px-3 py-2 text-sm"
                >
                  <span className="text-slate-200">{h.flower_name}</span>
                  <span className="text-slate-500">
                    {h.confidence != null ? h.confidence.toFixed(1) : "?"}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Column 2: Results */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-slate-200">Prediction</h2>

          {!result && (
            <p className="text-slate-500 text-sm">
              Upload an image and click "Identify Flower" to see results here.
            </p>
          )}

          {result && (
            <>
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-xl font-bold text-pink-400">{result.prediction}</span>
                  <span className="text-slate-300 font-semibold">
                    {result.confidence.toFixed(1)}%
                  </span>
                </div>
                <div className="mt-3">
                  <ConfidenceBar value={result.confidence} />
                </div>

                {!result.is_confident && (
                  <p className="mt-3 text-amber-400 bg-amber-950/40 border border-amber-900 rounded-lg p-2 text-sm">
                    Low confidence &mdash; the model isn't very sure about this one.
                  </p>
                )}

                {result.fun_fact && (
                  <p className="mt-3 text-slate-400 text-sm italic">{result.fun_fact}</p>
                )}
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-400 mb-2">Top 5 Candidates</h3>
                <div className="flex flex-col gap-3">
                  {result.top5.map((c) => (
                    <div key={c.class_id}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-300">{c.name}</span>
                        <span className="text-slate-500">{c.confidence.toFixed(1)}%</span>
                      </div>
                      <ConfidenceBar value={c.confidence} />
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </section>

        {/* Column 3: RAG + DAG */}
        <section className="flex flex-col gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h2 className="text-lg font-semibold text-slate-200 mb-3">Similar Flowers (RAG)</h2>
            {!result && (
              <p className="text-slate-500 text-sm">Results will appear after a prediction.</p>
            )}
            {result && (
              <div className="grid grid-cols-3 gap-3">
                {result.similar.map((s, i) => (
                  <div
                    key={i}
                    className="bg-slate-950 border border-slate-800 rounded-lg p-2 flex flex-col gap-1"
                  >
                    {s.image_b64 && (
                      <img
                        src={`data:image/jpeg;base64,${s.image_b64}`}
                        alt={s.name}
                        className="rounded-md aspect-square object-cover"
                      />
                    )}
                    <span className="text-xs text-slate-300 truncate">{s.name}</span>
                    <ConfidenceBar value={s.similarity} color="purple" />
                    <span className="text-xs text-slate-500">{s.similarity.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h2 className="text-lg font-semibold text-slate-200 mb-3">DAG Pipeline</h2>
            {!result && (
              <p className="text-slate-500 text-sm">
                The 7-node inference pipeline will appear here.
              </p>
            )}
            {result && (
              <ol className="relative border-l border-slate-700 ml-2 list-none">
                {result.dag_steps.map((step, i) => (
                  <li key={i} className="mb-5 ml-4 relative">
                    <span className="absolute -left-[25px] flex items-center justify-center w-4 h-4 rounded-full bg-pink-500 text-[10px] font-bold text-slate-950">
                      {i + 1}
                    </span>
                    <div className="flex justify-between items-baseline">
                      <h3 className="text-sm font-semibold text-slate-200">{step.node}</h3>
                      <span className="text-xs text-slate-500">{step.ms}ms</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{step.detail}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>
      </main>

      <footer className="text-center text-slate-600 text-xs py-6">
        FlowerLens AI &mdash; CSAL4333 Introduction to Deep Learning
      </footer>
    </div>
  );
}
