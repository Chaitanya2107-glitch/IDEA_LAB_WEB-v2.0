// src/pages/Print3D.tsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Upload,
  Printer,
  Settings,
  CheckCircle,
  Loader2,
  ChevronRight,
  Trash2,
  Weight,
  Box,
  Clock
} from "lucide-react";
import { User } from "../../types";
import { useNavigate } from "react-router-dom";
import { authService } from "../services/api";
import { motion } from "framer-motion";
import { StlViewer } from "../components/StlViewer";
import { STLLoader } from "three-stdlib";
import * as THREE from "three";

interface Print3DProps {
  user?: User;
}

const PRINTERS = [
  { id: "0.2-std", label: "0.2 mm Standard Quality", priceMult: 1 },
  { id: "0.15-med", label: "0.15 mm Medium Quality", priceMult: 1.2 },
  { id: "0.1-high", label: "0.1 mm High Quality", priceMult: 1.5 },
];

const Print3D: React.FC<Print3DProps> = ({ user }) => {
  const navigate = useNavigate();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [stlId, setStlId] = useState<string | null>(null);
  
  // Dynamic Materials
  const [materials, setMaterials] = useState<any[]>([]);
  const [loadingConfig, setLoadingConfig] = useState(true);

  // Simulated Analysis
  const [analysis, setAnalysis] = useState<{ volume: number, dimensions: string, rawSize?: { x:number, y:number, z:number } } | null>(null);
  
  // Config state
  const [printer, setPrinter] = useState(PRINTERS[0]);
  const [material, setMaterial] = useState<any | null>(null);
  const [color, setColor] = useState<any | null>(null);
  const [infill, setInfill] = useState(20);
  const [scale, setScale] = useState(100); // Percentage

  const [processing, setProcessing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);

  // Fetch Materials on Mount
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const data = await authService.getPrintMaterialsConfig();
        setMaterials(data || []);
        if (data && data.length > 0) {
          setMaterial(data[0]);
          if (data[0].colors && data[0].colors.length > 0) {
            setColor(data[0].colors[0]);
          }
        }
      } catch (err) {
        console.error("Failed to fetch material config:", err);
      } finally {
        setLoadingConfig(false);
      }
    };
    fetchConfig();
  }, []);

  // Cleanup Object URL to prevent memory leaks
  useEffect(() => {
    return () => {
      if (fileUrl) URL.revokeObjectURL(fileUrl);
    };
  }, [fileUrl]);

  // Handle material switch tracking
  useEffect(() => {
    if (material) {
      setColor(material.colors[0]);
    }
  }, [material]);

  const clearModel = () => {
     setFile(null);
     if (fileUrl) URL.revokeObjectURL(fileUrl);
     setFileUrl(null);
     setStlId(null);
     setAnalysis(null);
     setError(null);
     setScale(100);
     // Reset file input so the user can re-upload same or different file
     if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const f = e.target.files?.[0];
    if (!f) return;

    if (!f.name.toLowerCase().endsWith(".stl")) {
      setError("Only .STL files allowed");
      return;
    }

    setFile(f);
    const url = URL.createObjectURL(f);
    setFileUrl(url);
    setAnalysis(null); // clear stale values before new analysis
    setUploading(true);
    try {
      const arrayBuffer = await f.arrayBuffer();
      const loader = new STLLoader();
      const geometry = loader.parse(arrayBuffer);

      // Flatten indexed geometry so triangle iteration works correctly
      const flat = geometry.index ? geometry.toNonIndexed() : geometry.clone();
      flat.computeBoundingBox();
      const size = new THREE.Vector3();
      flat.boundingBox!.getSize(size);

      // Auto-detect units: < 1 means meters (some Fusion360/Blender exports)
      // Convert everything to mm before display
      const maxRaw = Math.max(size.x, size.y, size.z);
      const toMm = maxRaw < 1 ? 1000 : (maxRaw > 10000 ? 0.001 : 1);
      const widthMm = size.x * toMm;
      const heightMm = size.y * toMm;
      const depthMm = size.z * toMm;

      // Signed-volume divergence theorem — works on any closed manifold STL
      const pos = flat.attributes.position;
      let vol = 0;
      for (let i = 0; i < pos.count; i += 3) {
        const ax = pos.getX(i),   ay = pos.getY(i),   az = pos.getZ(i);
        const bx = pos.getX(i+1), by = pos.getY(i+1), bz = pos.getZ(i+1);
        const cx = pos.getX(i+2), cy = pos.getY(i+2), cz = pos.getZ(i+2);
        vol += (ax*(by*cz - bz*cy) + bx*(cy*az - cz*ay) + cx*(ay*bz - az*by)) / 6;
      }
      const volMm3 = Math.abs(vol) * (toMm * toMm * toMm); // convert to mm³

      setAnalysis({
        volume: +(volMm3 / 1000).toFixed(2),       // mm³ → cm³
        dimensions: `${(widthMm/10).toFixed(1)} × ${(heightMm/10).toFixed(1)} × ${(depthMm/10).toFixed(1)} cm`,
        rawSize: { x: widthMm, y: heightMm, z: depthMm } // always in mm
      });
      setStlId("stl-" + Date.now());
    } catch (err: any) {
      setError("Failed to analyze model. Please upload a valid STL file.");
    } finally {
      setUploading(false);
    }
  };

  const metrics = useMemo(() => {
    if (!analysis || !material) return { weight: 0, cost: 0, time: "-" };
    
    const scaleFactor = scale / 100;
    const scaledVolume = analysis.volume * Math.pow(scaleFactor, 3);
    
    // Calculate effective volume based on infill (approximation: 30% shells + 70% infill dependent)
    const effectiveVolume = scaledVolume * (0.3 + 0.7 * (infill / 100));
    const actualWeight = effectiveVolume * (material.density || 1.2);
    
    let baseCost = actualWeight * (material.price_per_gram || 4);
    baseCost *= printer.priceMult;

    // Time estimation (Bambu Lab reference: high speed but with overhead)
    // Faster print: ~25g per hour for high speed machines
    const baseHours = Math.max(0.2, (actualWeight / 25) * printer.priceMult);
    const overhead = 0.25; // 15 mins for heating, calibration, bed leveling
    const hours = baseHours + overhead;
    
    const h = Math.floor(hours);
    const m = Math.round((hours % 1) * 60);

    const widthMm = (analysis.rawSize?.x || 0) * scaleFactor;
    const heightMm = (analysis.rawSize?.y || 0) * scaleFactor;
    const depthMm = (analysis.rawSize?.z || 0) * scaleFactor;

    return {
      weight: Math.max(1, Math.round(actualWeight)),
      cost: Math.max(5, Math.round(baseCost)),
      time: `${h}h ${m}m`,
      dimensions: `${(widthMm/10).toFixed(1)} × ${(heightMm/10).toFixed(1)} × ${(depthMm/10).toFixed(1)} cm`
    };
  }, [analysis, material, printer, infill, scale]);

  const loadRazorpay = (): Promise<boolean> => {
    return new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
    });
  };

  const submitOrder = async () => {
    if (!analysis || !fileUrl || !file || !material) return;
    setProcessing(true);
    try {
      // 1. Upload the STL (signed upload URL scoped to this user)
      const { path: storagePath } = await authService.uploadFile('stl-files', file);

      // 2. Create the order; the server prices it from the uploaded model
      const orderData = await authService.createPrintOrder({
        storagePath,
        fileName: file.name,
        materialId: material.id,
        color: color?.name,
        infill,
        scale,
        quality: printer.id,
      });
      const orderRefId = "PRT-" + (orderData?.id?.slice(0, 8)?.toUpperCase() || "XXXXXXXX");

      // 3. Razorpay order for the server-side amount
      const checkout = await authService.createPaymentOrder(orderData.id);
      const isLoaded = await loadRazorpay();
      if (!isLoaded) {
          throw new Error("Razorpay SDK failed to load. Are you online?");
      }

      const options = {
          key: checkout.keyId,
          order_id: checkout.orderId,
          amount: checkout.amount, // paise
          currency: checkout.currency,
          name: "REVA IDEA Lab",
          description: `3D Print: ${file.name}`,
          image: "/img/logo_orange_new.png",
          handler: async function (response: any) {
              const payment = {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              };
              // Saved first: Razorpay may reload the page before verification finishes.
              // The dashboard retries it, and the Razorpay webhook confirms it regardless.
              localStorage.setItem('pending_payment_confirmation', JSON.stringify({ ...payment, timestamp: Date.now() }));
              try {
                  await authService.verifyPayment(payment);
                  localStorage.removeItem('pending_payment_confirmation');
                  setOrderId(orderRefId);
              } catch (e) {
                  console.error(e);
                  setError("Payment received. Confirmation is taking longer than usual; your order will update shortly.");
              } finally {
                  setProcessing(false);
              }
          },
          prefill: {
              name: user?.name || "Student",
              email: user?.email || "",
          },
          theme: {
              color: "#ea580c" // Tailwind brand-600
          },
          modal: {
              ondismiss: function() {
                  // Modal is closed by user
                  setError("Payment was cancelled. You can try again or check your pending orders.");
                  setProcessing(false);
              }
          }
      };

      const paymentObject = new (window as any).Razorpay(options);
      
      paymentObject.on('payment.failed', function (response: any){
          setError("Payment Failed: " + response.error.description);
          setProcessing(false);
      });
      
      paymentObject.open();

    } catch (err: any) {
      console.error("Submission error:", err);
      setError("Order submission failed: " + err.message);
      setProcessing(false);
    }
  };

  if (orderId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 pt-16">
         <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm"
         >
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-50 text-green-600">
              <CheckCircle className="h-6 w-6" aria-hidden="true" />
            </div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900">Order Confirmed!</h2>
            <p className="mt-2 text-sm text-slate-600">Your 3D print request has been sent to the lab.</p>

            <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
               <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Order Tracking ID</p>
               <p className="mt-1 font-mono text-lg font-semibold text-brand-600">{orderId}</p>
            </div>

            <button
               onClick={() => navigate("/dashboard")}
               className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
               Go to Dashboard
            </button>
         </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pt-16">
      <section className="bg-slate-50 py-8 md:py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h1 className="flex items-center gap-3 font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
             <Printer className="h-7 w-7 shrink-0 text-brand-500" aria-hidden="true" />
             Online 3D Printing Service
          </h1>
          <p className="mt-4 max-w-2xl text-base sm:text-lg leading-relaxed text-slate-600">Upload your STL model, configure print settings, and get an instant quote.</p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12 lg:gap-8">

          {/* LEFT COLUMN: Viewer & Principal Display (7/12) */}
          <div className="lg:col-span-7 space-y-6">

             {/* 3D Viewer Box */}
             <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
                {error && (
                   <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                      {error}
                   </div>
                )}
                <div className="relative h-[480px] overflow-hidden rounded-xl bg-slate-50">

                   {fileUrl && !uploading ? (
                      <>
                        <StlViewer fileUrl={fileUrl} color={color?.hex || "#CCCCCC"} rawSizeMm={analysis?.rawSize} scale={scale/100} />
                        <button
                           onClick={clearModel}
                           className="absolute top-4 right-4 z-20 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-white text-slate-500 shadow-sm ring-1 ring-slate-200 transition-colors hover:bg-red-50 hover:text-red-600"
                           title="Remove Model"
                           aria-label="Remove Model"
                        >
                           <Trash2 className="h-5 w-5" aria-hidden="true" />
                        </button>
                      </>
                   ) : uploading ? (
                      <div role="status" className="flex h-full flex-col items-center justify-center gap-3 rounded-xl border border-slate-200">
                         <Loader2 className="h-8 w-8 animate-spin text-brand-600" aria-hidden="true" />
                         <span className="text-sm font-medium text-slate-600">Synchronizing Pixels</span>
                      </div>
                   ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center transition-colors hover:border-brand-500 hover:bg-brand-50/50">
                         <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                             <Upload className="h-6 w-6" aria-hidden="true" />
                         </div>
                         <h3 className="font-display text-xl font-semibold text-slate-900">Prime the Printer</h3>
                         <p className="mt-1 text-sm text-slate-500">Upload your STL blueprint to begin.</p>

                         <label className="mt-6 inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 focus-within:ring-2 focus-within:ring-brand-500 focus-within:ring-offset-2">
                           Select STL File
                           <input
                             ref={fileInputRef}
                             type="file"
                             accept=".stl"
                             onChange={handleFileUpload}
                             className="sr-only"
                           />
                         </label>
                      </div>
                   )}
                </div>

                <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                   {[
                     { label: "Net Weight", val: analysis ? `${metrics.weight}g` : "-", icon: Weight },
                     { label: "Boundaries", val: analysis ? metrics.dimensions : "-", icon: Box },
                     { label: "Execution Time", val: analysis ? metrics.time : "-", icon: Clock }
                   ].map(i => (
                     <div key={i.label} className="flex flex-col gap-3 rounded-lg bg-slate-50 p-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                           <i.icon className="h-5 w-5" aria-hidden="true" />
                        </div>
                        <div>
                          <p className="text-sm text-slate-500">{i.label}</p>
                          <p className="mt-1 font-display text-lg font-semibold tabular-nums text-slate-900">{i.val}</p>
                        </div>
                     </div>
                   ))}
                </div>
             </div>
          </div>

          {/* RIGHT COLUMN: Configuration Menu (5/12) - Sticky */}
          <div className="lg:col-span-5 lg:sticky lg:top-24 space-y-6">
             <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="mb-6 font-display text-xl font-semibold text-slate-900">Forge Parameter Setup</h2>

                <div className="space-y-6">
                  {/* Step 2: Scaling & Infill */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="print3d-scale" className="mb-1.5 block text-sm font-medium text-slate-700">Master Scale</label>
                      <div className="relative">
                        <input
                          id="print3d-scale"
                          type="number"
                          value={scale}
                          onChange={(e) => setScale(Math.max(1, Math.min(1000, parseInt(e.target.value) || 1)))}
                          className="block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 pr-9 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
                        />
                        <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-500" aria-hidden="true">%</span>
                      </div>
                    </div>
                    <div>
                      <label htmlFor="print3d-infill" className="mb-1.5 block text-sm font-medium text-slate-700">Inner Bone (Infill)</label>
                      <div className="relative">
                        <select
                          id="print3d-infill"
                          value={infill}
                          onChange={(e) => setInfill(parseInt(e.target.value))}
                          className="block w-full appearance-none rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 pr-9 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
                        >
                          {[10, 20, 30, 50, 80, 100].map(v => (
                            <option key={v} value={v}>{v}%</option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2">
                           <Settings className="h-4 w-4 text-slate-400" aria-hidden="true" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Step 3: Material Select */}
                  <div>
                    <p className="mb-1.5 block text-sm font-medium text-slate-700">Alchemy Selection</p>
                    <div className="grid grid-cols-3 gap-2">
                      {materials.map(mat => (
                         <button
                            key={mat.id}
                            onClick={() => setMaterial(mat)}
                            aria-pressed={material?.id === mat.id}
                            className={`rounded-lg border px-4 py-3 text-left text-sm transition-colors ${material?.id === mat.id ? 'border-brand-600 bg-brand-50 text-brand-700 ring-1 ring-brand-600' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`}
                         >
                            {mat.name.split('-')[0]}
                         </button>
                      ))}
                    </div>
                  </div>

                  {/* Step 4: Color Palette */}
                  <div>
                      <p className="mb-1.5 block text-sm font-medium text-slate-700">Visual Essence</p>
                      <div className="flex flex-wrap gap-2">
                         {material?.colors?.map((c: any) => (
                            <button
                              key={c.name}
                              onClick={() => setColor(c)}
                              aria-label={c.name}
                              aria-pressed={color?.name === c.name}
                              className={`h-10 w-10 rounded-lg border-2 transition-colors ${color?.name === c.name ? 'border-white ring-2 ring-brand-600' : 'border-slate-200 hover:border-slate-300'}`}
                              style={{ background: c.hex }}
                              title={c.name}
                            />
                         ))}
                      </div>
                  </div>
                </div>

                {/* Pricing & Proceed - Sticky at bottom of card */}
                <div className="mt-8 border-t border-slate-200 pt-6">
                    <div className="mb-6 flex items-center justify-between gap-4">
                       <div>
                          <p className="text-sm text-slate-500">Final Transaction</p>
                          <div className="mt-1 flex items-baseline gap-2">
                             <span className="font-display text-3xl font-bold tracking-tight tabular-nums text-slate-900">₹{metrics.cost}</span>
                             <span className="text-xs font-medium text-slate-500">INR</span>
                          </div>
                       </div>
                       <div className="text-right">
                          <p className="text-sm text-slate-500">Status</p>
                          <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                             <span className="h-1.5 w-1.5 rounded-full bg-green-500" aria-hidden="true" /> Ready to Print
                          </p>
                       </div>
                    </div>

                    <button
                      onClick={submitOrder}
                      disabled={!fileUrl || processing || uploading || !material}
                      aria-busy={processing}
                      className="group inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {processing ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                          <>
                            Generate Order <ChevronRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                          </>
                        )}
                    </button>
                </div>

             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Print3D;
