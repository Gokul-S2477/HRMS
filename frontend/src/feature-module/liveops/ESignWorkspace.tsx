import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import API from "../../api/axios";
import CollapseHeader from "../../core/common/collapse-header/collapse-header";
import { useAuth } from "../../core/auth/AuthContext";
import {
  HrmEmptyState,
  HrmHero,
  formatDateTimeLabel,
  smartSearchMatch,
} from "../hrm/hrmShared";

const normalizeList = (data: any): any[] => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
};

const ESignWorkspace: React.FC = () => {
  const { user } = useAuth();
  const [signatures, setSignatures] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Signature modal state
  const [showModal, setShowModal] = useState(false);
  const [activeSig, setActiveSig] = useState<any>(null);
  const [signMode, setSignMode] = useState<"draw" | "upload">("draw");

  // Canvas state
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const [hasDrawn, setHasDrawn] = useState(false);

  // Upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get("/esign-signatures/");
      setSignatures(normalizeList(res.data));
    } catch {
      setSignatures([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() =>
    signatures.filter((sig) => {
      if (!smartSearchMatch(sig, search)) return false;
      if (statusFilter && sig.status !== statusFilter) return false;
      return true;
    }), [signatures, search, statusFilter]);

  const stats = useMemo(() => {
    const pending = signatures.filter((s) => s.status === "pending").length;
    const signed = signatures.filter((s) => s.status === "signed").length;
    return [
      { label: "Total Docs", value: signatures.length, meta: "Assigned to you" },
      { label: "Pending", value: pending, meta: "Awaiting your signature" },
      { label: "Signed", value: signed, meta: "Completed" },
      { label: "Completion", value: signatures.length ? `${Math.round((signed / signatures.length) * 100)}%` : "—", meta: "Your signing rate" },
    ];
  }, [signatures]);

  const openSignModal = (sig: any) => {
    setActiveSig(sig);
    setSignMode("draw");
    setHasDrawn(false);
    setUploadFile(null);
    setShowModal(true);
  };

  // ─── Canvas drawing ───────────────────────────────────────────────────
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#1a2340";
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  useEffect(() => {
    if (showModal && signMode === "draw") {
      setTimeout(initCanvas, 50);
    }
  }, [showModal, signMode, initCanvas]);

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const touch = e.touches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawingRef.current = true;
    lastPosRef.current = getPos(e, canvas);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e, canvas);
    const last = lastPosRef.current;
    if (last) {
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    }
    lastPosRef.current = pos;
    setHasDrawn(true);
  };

  const stopDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    drawingRef.current = false;
    lastPosRef.current = null;
  };

  const clearCanvas = () => {
    initCanvas();
    setHasDrawn(false);
  };

  const getCanvasBlob = (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const canvas = canvasRef.current;
      if (!canvas) return resolve(null);
      canvas.toBlob((blob) => resolve(blob), "image/png");
    });
  };

  // ─── Submit signature ─────────────────────────────────────────────────
  const handleSign = async () => {
    if (!activeSig) return;
    setSaving(true);
    try {
      if (signMode === "draw") {
        if (!hasDrawn) { alert("Please draw your signature first."); setSaving(false); return; }
        const blob = await getCanvasBlob();
        if (blob) {
          const formData = new FormData();
          formData.append("status", "signed");
          formData.append("signature_image", blob, "signature.png");
          await API.patch(`/esign-signatures/${activeSig.id}/`, formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });
        } else {
          await API.patch(`/esign-signatures/${activeSig.id}/`, { status: "signed" });
        }
      } else {
        if (!uploadFile) { alert("Please upload a signed document first."); setSaving(false); return; }
        const formData = new FormData();
        formData.append("status", "signed");
        formData.append("signed_document", uploadFile);
        await API.patch(`/esign-signatures/${activeSig.id}/`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }
      setShowModal(false);
      setActiveSig(null);
      load();
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Failed to submit signature.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-wrapper">
      <div className="content container-fluid payroll-shell employee-shell">
        <HrmHero
          kicker="My Signatures"
          title="E-Sign Workspace"
          subtitle="Review and sign documents assigned to you. Draw your signature directly in the browser or upload a signed copy."
          action={<CollapseHeader />}
          stats={stats}
        >
          <span className="employee-chip"><i className="ti ti-writing" /> Draw or upload your signature</span>
          <span className="employee-chip"><i className="ti ti-clock" /> Complete pending signatures promptly</span>
        </HrmHero>

        {/* Documents table */}
        <div className="card payroll-panel payroll-table-card">
          <div className="payroll-table-header">
            <div>
              <h5>My Document Queue</h5>
              <div className="payroll-table-subtitle">Documents awaiting or completed with your signature.</div>
            </div>
            <div className="payroll-table-controls">
              <input
                className="form-control"
                style={{ minWidth: 240 }}
                placeholder="Search documents…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                className="form-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All statuses</option>
                <option value="pending">Pending</option>
                <option value="signed">Signed</option>
              </select>
              <button className="btn btn-outline-secondary" onClick={() => { setSearch(""); setStatusFilter(""); }}>
                <i className="ti ti-filter-off" />
              </button>
            </div>
          </div>

          <div className="card-body">
            {loading ? (
              <div className="payroll-empty">
                <i className="ti ti-loader-2" style={{ animation: "spin 1s linear infinite" }} />
                <p>Loading your documents…</p>
              </div>
            ) : filtered.length === 0 ? (
              <HrmEmptyState
                title="No documents assigned to you"
                description="When HR distributes a document for e-signing, it will appear here for your action."
              />
            ) : (
              <div className="table-responsive">
                <table className="table align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Document</th>
                      <th>Status</th>
                      <th>Assigned</th>
                      <th>Signed At</th>
                      <th className="text-end">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((sig) => (
                      <tr key={sig.id}>
                        <td>
                          <div className="payroll-avatar-block">
                            <span className="payroll-avatar-icon">
                              <i className="ti ti-file-text" />
                            </span>
                            <div>
                              <div className="payroll-primary-text">
                                {sig.document?.title || `Document #${sig.document}`}
                              </div>
                              <div className="payroll-secondary-text">
                                {sig.document?.description || "—"}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={`payroll-badge ${sig.status === "signed" ? "success" : "warning"}`}>
                            <i className={`ti ${sig.status === "signed" ? "ti-circle-check" : "ti-clock"} me-1`} />
                            {sig.status === "signed" ? "Signed" : "Pending"}
                          </span>
                        </td>
                        <td className="payroll-secondary-text">
                          {formatDateTimeLabel(sig.created_at)}
                        </td>
                        <td className="payroll-secondary-text">
                          {sig.signed_at ? formatDateTimeLabel(sig.signed_at) : "—"}
                        </td>
                        <td>
                          <div className="d-flex justify-content-end gap-2">
                            {sig.document?.file && (
                              <a
                                href={sig.document.file}
                                target="_blank"
                                rel="noreferrer"
                                className="btn btn-sm btn-outline-secondary"
                                title="View Document"
                              >
                                <i className="ti ti-eye" />
                              </a>
                            )}
                            {sig.status === "pending" && (
                              <button
                                type="button"
                                className="btn btn-sm btn-primary"
                                onClick={() => openSignModal(sig)}
                              >
                                <i className="ti ti-signature me-1" />
                                Sign Now
                              </button>
                            )}
                            {sig.status === "signed" && (
                              <span className="payroll-badge success" style={{ fontSize: 12 }}>
                                <i className="ti ti-circle-check me-1" /> Completed
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SIGN MODAL */}
      {showModal && activeSig && (
        <>
          <div className="modal show d-block payroll-modal" tabIndex={-1} style={{ zIndex: 1050 }}>
            <div className="modal-dialog modal-lg modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    <i className="ti ti-signature me-2 text-primary" />
                    Sign: {activeSig.document?.title || "Document"}
                  </h5>
                  <button type="button" className="btn-close" onClick={() => setShowModal(false)} />
                </div>
                <div className="modal-body">
                  {/* Document preview link */}
                  {activeSig.document?.file && (
                    <div className="finance-note-card mb-3">
                      <i className="ti ti-file-text" />
                      <div>
                        <div className="fw-semibold mb-1">Review the document before signing</div>
                        <a href={activeSig.document.file} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline-primary">
                          <i className="ti ti-external-link me-1" />Open Document
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Mode selector */}
                  <div className="payroll-segmented mb-4">
                    <button
                      type="button"
                      className={`btn ${signMode === "draw" ? "btn-primary" : "btn-light"}`}
                      onClick={() => setSignMode("draw")}
                    >
                      <i className="ti ti-writing me-1" /> Draw Signature
                    </button>
                    <button
                      type="button"
                      className={`btn ${signMode === "upload" ? "btn-primary" : "btn-light"}`}
                      onClick={() => setSignMode("upload")}
                    >
                      <i className="ti ti-upload me-1" /> Upload Signed Doc
                    </button>
                  </div>

                  {/* Draw mode */}
                  {signMode === "draw" && (
                    <div>
                      <div className="d-flex align-items-center justify-content-between mb-2">
                        <label className="form-label mb-0">Draw your signature in the box below</label>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          onClick={clearCanvas}
                        >
                          <i className="ti ti-refresh me-1" />Clear
                        </button>
                      </div>
                      <div
                        style={{
                          border: "2px dashed #e2e8f0",
                          borderRadius: 16,
                          overflow: "hidden",
                          background: "#f8fafc",
                          cursor: "crosshair",
                          touchAction: "none",
                        }}
                      >
                        <canvas
                          ref={canvasRef}
                          width={680}
                          height={200}
                          style={{ width: "100%", height: 200, display: "block" }}
                          onMouseDown={startDraw}
                          onMouseMove={draw}
                          onMouseUp={stopDraw}
                          onMouseLeave={stopDraw}
                          onTouchStart={startDraw}
                          onTouchMove={draw}
                          onTouchEnd={stopDraw}
                        />
                      </div>
                      <div className="finance-form-hint">
                        <i className="ti ti-info-circle me-1" />
                        Use your mouse or touch screen to draw your signature. Click Clear to start over.
                      </div>
                    </div>
                  )}

                  {/* Upload mode */}
                  {signMode === "upload" && (
                    <div>
                      <label className="form-label">Upload your signed document</label>
                      <input
                        type="file"
                        className="form-control"
                        accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                        onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                      />
                      <div className="finance-form-hint">
                        <i className="ti ti-info-circle me-1" />
                        Download the document, sign it physically or digitally, then upload the signed version here.
                      </div>
                      {uploadFile && (
                        <div className="finance-note-card mt-3">
                          <i className="ti ti-file-check" />
                          <div>
                            <div className="fw-semibold">{uploadFile.name}</div>
                            <div className="text-muted small">{(uploadFile.size / 1024).toFixed(1)} KB</div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Legal notice */}
                  <div className="finance-note-card mt-4">
                    <i className="ti ti-shield-check" />
                    <div style={{ fontSize: 12, color: "#5a6782" }}>
                      By clicking <strong>Confirm Signature</strong> you agree that this constitutes a legally binding
                      electronic signature. Your IP address and timestamp will be recorded.
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-light" onClick={() => setShowModal(false)}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleSign}
                    disabled={saving}
                  >
                    {saving ? (
                      <><i className="ti ti-loader-2 me-2" style={{ animation: "spin 1s linear infinite" }} />Submitting…</>
                    ) : (
                      <><i className="ti ti-circle-check me-2" />Confirm Signature</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop show" style={{ zIndex: 1040 }} />
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default ESignWorkspace;
