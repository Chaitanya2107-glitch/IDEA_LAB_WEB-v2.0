
import React, { useState, useEffect } from 'react';
import { Upload, CircuitBoard, CreditCard, Banknote, CheckCircle, ArrowRight, Loader2, AlertTriangle } from 'lucide-react';
import { User, PcbOrder } from '../../types';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../services/api';
import { payWithRazorpay } from '../utils/razorpay';

interface PcbOrderProps {
  user?: User;
}

const PcbOrderPage: React.FC<PcbOrderProps> = ({ user }) => {
  const navigate = useNavigate();
  const [fileUrl, setFileUrl] = useState<string | null>(null); // For local viewer if needed, not used in this component
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Specs State
  const [specs, setSpecs] = useState({
      material: 'FR-4',
      layers: 2,
      dimensionL: 100,
      dimensionW: 100,
      quantity: 5,
      thickness: '1.6mm',
      copperWeight: '1oz',
      solderMaskColor: 'Green',
      silkscreenColor: 'White',
      surfaceFinish: 'HASL with lead',
      minTrace: '10/10mil',
      minDrill: '0.3mm'
  });

  const [paymentMethod, setPaymentMethod] = useState<'online' | 'cash'>('online');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [successOrder, setSuccessOrder] = useState<string | null>(null);

  const calculatePrice = () => {
      // Mock pricing logic
      const area = specs.dimensionL * specs.dimensionW; // mm^2
      const basePrice = 500; // Base setup cost
      const areaCost = (area / 100) * 0.5; // per 100mm^2
      const layerMultiplier = specs.layers * 0.5;
      const quantityMultiplier = specs.quantity * 0.8;
      const finishMultiplier = specs.surfaceFinish.includes('ENIG') ? 1.5 : 1;
      
      const total = (basePrice + areaCost * layerMultiplier) * quantityMultiplier * finishMultiplier;
      return Math.round(total);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    if (e.target.files && e.target.files[0]) {
      const uploadedFile = e.target.files[0];
      if (uploadedFile.size > 50 * 1024 * 1024) {
        setErrorMsg("File is too large (Max 50MB).");
        return;
      }
      
      const ext = uploadedFile.name.split('.').pop()?.toLowerCase();
      if (!['zip', 'rar', 'pcb', 'kicad_pcb', 'gerber'].includes(ext || '')) {
         setErrorMsg("Invalid format. Please upload .zip, .rar, or PCB files.");
         return;
      }

      if (fileUrl) URL.revokeObjectURL(fileUrl); // Clean up previous URL
      // For a real app, this file would be uploaded to storage and a path obtained here.
      setFile(uploadedFile);
      setAnalyzing(true);
      
      // Simulate file analysis
      setTimeout(() => {
        setAnalyzing(false);
        setStep(2);
      }, 1500);
    }
  };

  const handleSubmitOrder = async () => {
    if (!file) return;
    setErrorMsg(null);
    setIsProcessingPayment(true);
    try {
      // 1. Upload the design files (private: only you and lab staff can open them).
      const { path: storagePath } = await authService.uploadFile('pcb-files', file);

      // 2. Place the order. The server calculates the price from the specifications.
      const order = await authService.createPcbOrder({
        fileName: file.name,
        storagePath,
        paymentMethod: paymentMethod === 'online' ? 'online' : 'lab',
        specs: {
          material: specs.material,
          layers: specs.layers,
          dimensions: `${specs.dimensionL}x${specs.dimensionW}mm`,
          quantity: specs.quantity,
          thickness: specs.thickness,
          copperWeight: specs.copperWeight,
          solderMaskColor: specs.solderMaskColor,
          silkscreenColor: specs.silkscreenColor,
          surfaceFinish: specs.surfaceFinish,
        },
      });
      const reference = 'PCB-' + order.id.slice(0, 8).toUpperCase();

      if (paymentMethod === 'online') {
        // 3. Pay the server's price with Razorpay; the server verifies the payment.
        const checkout = await authService.createPcbPaymentOrder(order.id);
        const result = await payWithRazorpay(checkout, {
          description: `PCB fabrication: ${file.name}`,
          name: user?.name,
          email: user?.email,
        });
        if (result.outcome === 'dismissed') {
          setErrorMsg('Payment was cancelled. The order stays unpaid for 30 minutes; place it again if it expires.');
          return;
        }
        if (result.outcome === 'failed') {
          setErrorMsg(`Payment failed: ${result.message}`);
          return;
        }
        if (result.outcome === 'unconfirmed') {
          setErrorMsg('Payment received. Confirmation is taking longer than usual; your order will update shortly.');
        }
      }

      setSuccessOrder(reference);
      setStep(4);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not place the order. Please try again.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const SOLDER_COLORS = [
      { name: 'Green', hex: '#16a34a' },
      { name: 'Red', hex: '#dc2626' },
      { name: 'Yellow', hex: '#ca8a04' },
      { name: 'Blue', hex: '#2563eb' },
      { name: 'White', hex: '#f8fafc' },
      { name: 'Black', hex: '#1e293b' },
      { name: 'Purple', hex: '#7e22ce' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 pt-16">
        {/* Header */}
        <section className="bg-slate-50 py-8 md:py-10">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div className="flex items-center gap-3">
                         <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                            <CircuitBoard className="h-5 w-5" aria-hidden="true" />
                         </div>
                         <div>
                            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">PCB Studio</h1>
                            <p className="text-sm text-slate-500">Fabrication Engine v1.0</p>
                         </div>
                    </div>
                    <div className="flex items-center gap-4 md:gap-6">
                         <div className="hidden md:flex flex-col items-end">
                            <span className="text-sm text-slate-500">Est. Turnaround</span>
                            <span className="text-sm font-semibold text-slate-900">3-5 Days</span>
                         </div>
                         <div className="hidden h-8 w-px bg-slate-200 md:block"></div>
                         <button onClick={() => navigate('/dashboard')} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50">
                            Back to Dashboard
                         </button>
                    </div>
                </div>
            </div>
        </section>

        <div className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-start">
            {/* Visualizer / Placeholder Area */}
            <div className="hidden md:flex md:w-1/3 flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                 <div>
                     <div className={`mx-auto flex h-48 w-48 items-center justify-center rounded-xl border-2 transition-colors lg:h-64 lg:w-64 ${step >= 2 ? 'border-brand-600 bg-brand-50' : 'border-slate-200 bg-slate-50'}`}>
                         <CircuitBoard className={`h-24 w-24 transition-colors lg:h-32 lg:w-32 ${step >= 2 ? 'text-brand-500' : 'text-slate-300'}`} aria-hidden="true" />
                     </div>
                     <h3 className="mt-6 font-display text-xl font-semibold text-slate-900">{step === 1 ? 'Upload Design' : 'Configure Board'}</h3>
                     <p className="mx-auto mt-2 max-w-xs text-sm text-slate-600">
                        {step === 1 ? 'Upload your Gerber files (zip/rar) to begin analysis.' : 'Customize layer stackup, materials, and finish for your PCB.'}
                     </p>
                 </div>
            </div>

            {/* Form / Content Area */}
            <div className="min-w-0 flex-grow rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 p-4 md:p-6">
                    <div className="mb-3 flex items-center justify-between md:mb-4">
                        <span className="flex items-center gap-2 text-sm font-medium text-slate-500">
                            <span className="h-2 w-2 rounded-full bg-brand-500" aria-hidden="true"></span>
                            Step {step} of 4
                        </span>
                        {step > 1 && step < 4 && <button onClick={() => setStep(step-1)} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700 hover:underline underline-offset-4">Go Back</button>}
                    </div>
                    <div className="flex h-1.5 gap-2" aria-hidden="true">
                        {[1, 2, 3, 4].map(s => (
                            <div key={s} className={`flex-1 rounded-full transition-colors duration-500 ${step >= s ? 'bg-brand-600' : 'bg-slate-200'}`}></div>
                        ))}
                    </div>
                </div>

                <div className="p-4 md:p-8">

                    {/* STEP 1: UPLOAD */}
                    {step === 1 && (
                        <div className="mx-auto flex max-w-2xl flex-col justify-center space-y-6 animate-slide-up">
                            <div className="relative flex h-64 w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center transition-colors hover:border-brand-500 hover:bg-brand-50/50 focus-within:border-brand-500">
                                {analyzing ? (
                                    <div className="text-center" role="status">
                                        <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-brand-600" aria-hidden="true" />
                                        <p className="text-sm font-medium text-slate-700">Analyzing Gerber Files...</p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                                            <Upload className="h-6 w-6" aria-hidden="true" />
                                        </div>
                                        <p className="text-base font-semibold text-slate-900">Upload Gerber / Zip</p>
                                        <p className="mt-1 text-sm text-slate-500">Supports .zip, .rar, .pcb (Max 50MB)</p>
                                        <input type="file" accept=".zip,.rar,.pcb,.kicad_pcb" aria-label="Upload Gerber / Zip" className="absolute inset-0 cursor-pointer opacity-0" onChange={handleFileUpload} />
                                    </>
                                )}
                            </div>
                            {errorMsg && (
                                <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                                    <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" /> {errorMsg}
                                </div>
                            )}
                        </div>
                    )}

                    {/* STEP 2: CONFIGURATION */}
                    {step === 2 && (
                        <div className="mx-auto max-w-3xl space-y-8 animate-slide-up">

                            {/* Board Info */}
                            <div className="space-y-4">
                                <h3 className="border-b border-slate-200 pb-2 font-display text-lg font-semibold text-slate-900">Board Specifications</h3>
                                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                    <div>
                                        <p className="mb-1.5 block text-sm font-medium text-slate-700">Base Material</p>
                                        <div className="grid grid-cols-2 gap-2">
                                            {['FR-4', 'Aluminum', 'Rogers', 'FR-1'].map(m => (
                                                <button key={m} aria-pressed={specs.material === m} onClick={() => setSpecs({...specs, material: m})} className={`rounded-lg border px-4 py-3 text-left text-sm transition-colors ${specs.material === m ? 'border-brand-600 bg-brand-50 text-brand-700 ring-1 ring-brand-600' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`}>
                                                    {m}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <p className="mb-1.5 block text-sm font-medium text-slate-700">Layer Count</p>
                                        <div className="flex flex-wrap gap-2">
                                            {[1, 2, 4, 6, 8].map(l => (
                                                <button key={l} aria-pressed={specs.layers === l} onClick={() => setSpecs({...specs, layers: l})} className={`flex h-10 w-10 items-center justify-center rounded-lg border text-sm font-medium transition-colors ${specs.layers === l ? 'border-brand-600 bg-brand-50 text-brand-700 ring-1 ring-brand-600' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`}>
                                                    {l}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <p className="mb-1.5 block text-sm font-medium text-slate-700">Dimensions (mm)</p>
                                        <div className="flex items-center gap-2">
                                            <input type="number" aria-label="Length (mm)" value={specs.dimensionL} onChange={e => setSpecs({...specs, dimensionL: parseInt(e.target.value)})} className="block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500" />
                                            <span className="text-sm text-slate-500">x</span>
                                            <input type="number" aria-label="Width (mm)" value={specs.dimensionW} onChange={e => setSpecs({...specs, dimensionW: parseInt(e.target.value)})} className="block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500" />
                                        </div>
                                    </div>
                                    <div>
                                        <label htmlFor="pcb-quantity" className="mb-1.5 block text-sm font-medium text-slate-700">Quantity</label>
                                        <input id="pcb-quantity" type="number" value={specs.quantity} onChange={e => setSpecs({...specs, quantity: parseInt(e.target.value)})} className="block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500" />
                                    </div>
                                </div>
                            </div>

                            {/* Process Details */}
                            <div className="space-y-4">
                                <h3 className="border-b border-slate-200 pb-2 font-display text-lg font-semibold text-slate-900">Process Details</h3>

                                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                    <div>
                                        <label htmlFor="pcb-thickness" className="mb-1.5 block text-sm font-medium text-slate-700">PCB Thickness</label>
                                        <select id="pcb-thickness" value={specs.thickness} onChange={e => setSpecs({...specs, thickness: e.target.value})} className="block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500">
                                            <option>0.6mm</option>
                                            <option>0.8mm</option>
                                            <option>1.0mm</option>
                                            <option>1.2mm</option>
                                            <option>1.6mm</option>
                                            <option>2.0mm</option>
                                        </select>
                                    </div>
                                    <div>
                                        <p className="mb-1.5 block text-sm font-medium text-slate-700">Copper Weight</p>
                                        <div className="flex gap-2">
                                            {['1oz', '2oz'].map(w => (
                                                <button key={w} aria-pressed={specs.copperWeight === w} onClick={() => setSpecs({...specs, copperWeight: w})} className={`flex-1 rounded-lg border px-4 py-2.5 text-center text-sm font-medium transition-colors ${specs.copperWeight === w ? 'border-brand-600 bg-brand-50 text-brand-700 ring-1 ring-brand-600' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`}>
                                                    {w}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="md:col-span-2">
                                        <p className="mb-1.5 block text-sm font-medium text-slate-700">Solder Mask Color</p>
                                        <div className="flex flex-wrap gap-3">
                                            {SOLDER_COLORS.map(c => (
                                                <button
                                                    key={c.name}
                                                    onClick={() => setSpecs({...specs, solderMaskColor: c.name})}
                                                    aria-label={c.name}
                                                    aria-pressed={specs.solderMaskColor === c.name}
                                                    className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors ${specs.solderMaskColor === c.name ? 'border-white ring-2 ring-brand-600' : 'border-slate-200 hover:border-slate-300'}`}
                                                    style={{ backgroundColor: c.hex }}
                                                    title={c.name}
                                                >
                                                    {specs.solderMaskColor === c.name && <CheckCircle className={`h-5 w-5 ${c.name === 'White' ? 'text-slate-900' : 'text-white'}`} aria-hidden="true" />}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <p className="mb-1.5 block text-sm font-medium text-slate-700">Silkscreen</p>
                                        <div className="flex gap-2">
                                            {['White', 'Black', 'None'].map(s => (
                                                <button key={s} aria-pressed={specs.silkscreenColor === s} onClick={() => setSpecs({...specs, silkscreenColor: s})} className={`flex-1 rounded-lg border px-4 py-2.5 text-center text-sm font-medium transition-colors ${specs.silkscreenColor === s ? 'border-brand-600 bg-brand-50 text-brand-700 ring-1 ring-brand-600' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`}>
                                                    {s}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label htmlFor="pcb-surface-finish" className="mb-1.5 block text-sm font-medium text-slate-700">Surface Finish</label>
                                        <select id="pcb-surface-finish" value={specs.surfaceFinish} onChange={e => setSpecs({...specs, surfaceFinish: e.target.value})} className="block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500">
                                            <option>HASL with lead</option>
                                            <option>HASL lead free</option>
                                            <option>ENIG (Gold)</option>
                                            <option>OSP</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col items-center justify-between gap-4 border-t border-slate-200 pt-6 md:flex-row">
                                <div>
                                    <p className="text-sm text-slate-500">Total Estimated Cost</p>
                                    <p className="font-display text-3xl font-bold tracking-tight tabular-nums text-slate-900">₹{calculatePrice()}</p>
                                </div>
                                <button onClick={() => setStep(3)} className="group inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50 md:w-auto">
                                    Proceed to Review <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP 3: REVIEW */}
                    {step === 3 && (
                        <div className="mx-auto max-w-xl space-y-6 animate-slide-up">
                            <div><h2 className="font-display text-xl font-semibold text-slate-900">Review Order</h2><p className="mt-1 text-sm text-slate-600">Verify specifications before payment.</p></div>
                            {errorMsg && (
                                <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {errorMsg}
                                </div>
                            )}

                            <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-6">
                                <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-4">
                                    <span className="text-sm text-slate-500">File</span>
                                    <span className="break-all text-right text-sm font-medium text-slate-900">{file?.name}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div><span className="block text-xs text-slate-500">Dimensions</span> <span className="font-medium text-slate-900">{specs.dimensionL}x{specs.dimensionW} mm</span></div>
                                    <div><span className="block text-xs text-slate-500">Layers</span> <span className="font-medium text-slate-900">{specs.layers}</span></div>
                                    <div><span className="block text-xs text-slate-500">Material</span> <span className="font-medium text-slate-900">{specs.material}</span></div>
                                    <div><span className="block text-xs text-slate-500">Quantity</span> <span className="font-medium text-slate-900">{specs.quantity}</span></div>
                                    <div><span className="block text-xs text-slate-500">Solder Mask</span> <span className="font-medium text-slate-900">{specs.solderMaskColor}</span></div>
                                    <div><span className="block text-xs text-slate-500">Silkscreen</span> <span className="font-medium text-slate-900">{specs.silkscreenColor}</span></div>
                                </div>
                                <div className="flex items-end justify-between border-t border-slate-200 pt-4">
                                    <span className="text-sm font-medium text-slate-700">Total Cost</span>
                                    <span className="font-display text-2xl font-bold tabular-nums text-slate-900">₹{calculatePrice()}</span>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <button onClick={() => setPaymentMethod('online')} aria-pressed={paymentMethod === 'online'} className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left text-sm transition-colors ${paymentMethod === 'online' ? 'border-brand-600 bg-brand-50 text-brand-700 ring-1 ring-brand-600' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`}><span className="flex items-center gap-3"><span className={`inline-flex rounded-lg p-2 ${paymentMethod === 'online' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500'}`}><CreditCard className="h-5 w-5" aria-hidden="true" /></span><span className="font-semibold">Pay Online</span></span>{paymentMethod === 'online' && <CheckCircle className="h-5 w-5 text-brand-600" aria-hidden="true" />}</button>
                                <button onClick={() => setPaymentMethod('cash')} aria-pressed={paymentMethod === 'cash'} className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left text-sm transition-colors ${paymentMethod === 'cash' ? 'border-brand-600 bg-brand-50 text-brand-700 ring-1 ring-brand-600' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`}><span className="flex items-center gap-3"><span className={`inline-flex rounded-lg p-2 ${paymentMethod === 'cash' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500'}`}><Banknote className="h-5 w-5" aria-hidden="true" /></span><span className="font-semibold">Pay at Lab</span></span>{paymentMethod === 'cash' && <CheckCircle className="h-5 w-5 text-brand-600" aria-hidden="true" />}</button>
                            </div>

                            <button onClick={handleSubmitOrder} disabled={isProcessingPayment} aria-busy={isProcessingPayment} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50">{isProcessingPayment ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Confirm Order'}</button>
                        </div>
                    )}

                    {/* STEP 4: SUCCESS */}
                    {step === 4 && (
                        <div className="flex flex-col items-center justify-center py-12 text-center animate-slide-up">
                            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-50 text-green-600"><CheckCircle className="h-6 w-6" aria-hidden="true" /></div>
                            <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900">Order Placed Successfully!</h2>
                            <p className="mx-auto mt-2 max-w-xs text-sm text-slate-600">Your PCB order has been sent to the fabrication unit. You can track progress in your dashboard.</p>
                            <div className="mx-auto mt-6 w-full max-w-xs rounded-lg border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Order ID</p><p className="mt-1 font-mono text-lg font-semibold text-brand-600">{successOrder}</p></div>
                            <button onClick={() => navigate('/dashboard')} className="mt-6 inline-flex w-full max-w-xs items-center justify-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50">Go to Dashboard</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
        </div>

        {showPaymentModal && (
            <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
                <div className="absolute inset-0 bg-slate-900/50" onClick={() => setShowPaymentModal(false)}></div>
                <div role="dialog" aria-modal="true" aria-labelledby="pcb-payment-title" className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl ring-1 ring-slate-200 animate-slide-up">
                    <div className="flex flex-col items-center justify-center px-6 py-12 text-center" role="status"><Loader2 className="mb-4 h-8 w-8 animate-spin text-brand-600" aria-hidden="true" /><h3 id="pcb-payment-title" className="font-display text-xl font-semibold text-slate-900">Processing Payment</h3><p className="mt-1 text-sm text-slate-500">Please wait...</p></div>
                </div>
            </div>
        )}
    </div>
  );
};

export default PcbOrderPage;
