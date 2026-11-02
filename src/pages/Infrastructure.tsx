import React, { useEffect } from 'react';
import { 
  Printer, 
  Cpu, 
  Settings, 
  Wrench, 
  Scissors,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  Settings as ToolIcon
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { FadeIn } from '../components/FadeIn';

const equipmentCategories = [
  {
    category: "3D Printing & Prototyping",
    description: "State-of-the-art additive manufacturing systems for rapid prototyping and complex geometry fabrication.",
    icon: <Printer className="h-5 w-5" aria-hidden="true" />,
    items: [
      { name: "Stratasys F170", specs: "Industrial FDM, 254 × 254 × 254 mm", status: "Available" },
      { name: "Formlabs Form 3+", specs: "SLA Resin, High Detail resolution", status: "In Use" },
      { name: "Markforged Mark Two", specs: "Continuous Carbon Fiber Printing", status: "Maintenance" },
      { name: "Prusa i3 MK3S+", specs: "Desktop FDM, Multi-material", status: "Available" }
    ]
  },
  {
    category: "Subtractive Manufacturing",
    description: "High-precision CNC and laser systems for cutting, engraving, routing, and precision milling.",
    icon: <Scissors className="h-5 w-5" aria-hidden="true" />,
    items: [
      { name: "Epilog Fusion Pro Laser", specs: "120W CO2, 48\" x 36\" bed", status: "Available" },
      { name: "ShopBot Desktop MAX CNC", specs: "36\" x 24\" Wood & Plastics", status: "Available" },
      { name: "Bantam Tools PCB Mill", specs: "Desktop high-speed precision", status: "In Use" },
      { name: "Tormach 1100M CNC Mill", specs: "Personal CNC for metal cutting", status: "Available" }
    ]
  },
  {
    category: "Electronics & Embedded",
    description: "Comprehensive anti-static workstations for circuit design, testing, diagnostics, and soldering.",
    icon: <Cpu className="h-5 w-5" aria-hidden="true" />,
    items: [
      { name: "Rigol MSO5000", specs: "4-Channel, 350 MHz Oscilloscope", status: "Available" },
      { name: "Hakko FX-951", specs: "Digital Controlled Soldering Stations", status: "Available" },
      { name: "Siglent SPD3303X", specs: "Programmable Linear DC Power", status: "Available" },
      { name: "Fluke 87V", specs: "Industrial True-RMS Multimeters", status: "In Use" }
    ]
  },
  {
    category: "Mechanical Fabrication",
    description: "Heavy-duty traditional workshop tools for metal, wood, composite shaping, and finishing.",
    icon: <Wrench className="h-5 w-5" aria-hidden="true" />,
    items: [
      { name: "Bridgeport Milling Machine", specs: "Manual Knee Mill", status: "Available" },
      { name: "Grizzly Industrial Lathe", specs: "12\" x 36\" Gear-Head", status: "Maintenance" },
      { name: "DeWalt Drill Press", specs: "Heavy Duty Floor Model", status: "Available" },
      { name: "Makita Cold Saw", specs: "12-Inch Metal Cutting", status: "Available" }
    ]
  }
];

const Infrastructure: React.FC = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const getStatusIcon = (status: string) => {
    switch(status) {
      case "Available": return <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />;
      case "In Use": return <Clock className="h-3.5 w-3.5" aria-hidden="true" />;
      case "Maintenance": return <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />;
      default: return null;
    }
  };

  const getStatusTextClasses = (status: string) => {
    switch(status) {
      case "Available": return "bg-green-50 text-green-700 ring-green-600/20";
      case "In Use": return "bg-brand-50 text-brand-700 ring-brand-600/20";
      case "Maintenance": return "bg-amber-50 text-amber-700 ring-amber-600/20";
      default: return "bg-slate-100 text-slate-700 ring-slate-600/10";
    }
  };

  return (
    <div className="bg-white min-h-screen">
      {/* ── Page header ── */}
      <section className="border-b border-slate-200 bg-white pt-24 pb-10 md:pt-28 md:pb-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <FadeIn>
                <span className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold uppercase tracking-wider text-brand-600">
                    <ToolIcon className="h-4 w-4" aria-hidden="true" /> Industrial Grade
                </span>
                <h1 className="mt-2 font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900">
                    Built for <br />
                    <span className="text-brand-600">Excellence.</span>
                </h1>
                <p className="mt-4 max-w-2xl text-base sm:text-lg leading-relaxed text-slate-600">
                    The REVA IDEA Lab host a comprehensive ecosystem of high-precision tools and industrial machinery designed to support the entire product development lifecycle.
                </p>
            </FadeIn>
        </div>
      </section>

      {/* Intro Section */}
      <section className="bg-white py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:gap-16 lg:grid-cols-2 items-center">
            <FadeIn>
              <div className="space-y-10">
                <div className="relative pl-5">
                  <div className="absolute left-0 top-1 h-10 w-1 rounded-full bg-brand-500" aria-hidden="true" />
                  <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-slate-900">Rapid Prototyping</h2>
                  <p className="mt-4 text-base sm:text-lg leading-relaxed text-slate-600">
                      From initial sketches to functional prototypes, our lab provides the exact tools needed for high-fidelity model creation and testing.
                  </p>
                </div>
                <div className="relative pl-5">
                  <div className="absolute left-0 top-1 h-10 w-1 rounded-full bg-brand-500" aria-hidden="true" />
                  <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-slate-900">Advanced Manufacturing</h2>
                  <p className="mt-4 text-base sm:text-lg leading-relaxed text-slate-600">
                      Utilize industry-standard subtractive and additive systems to manufacture durable, end-use parts and complex assemblies.
                  </p>
                </div>
              </div>
            </FadeIn>
            <FadeIn delay={0.1}>
              <div className="relative aspect-square overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                <img 
                  src="/img/homepage/DSC_4856.JPG" 
                  alt="Infrastructure" 
                  className="h-full w-full object-cover"
                />
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* Equipment Categories */}
      <section className="bg-slate-50 py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <FadeIn>
                <div className="mx-auto max-w-2xl text-center mb-10 md:mb-14">
                    <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-slate-900">Laboratory Catalog</h2>
                    <p className="mt-4 text-base sm:text-lg leading-relaxed text-slate-600">"Explore the heavy machinery and precision tools that power innovation."</p>
                </div>
            </FadeIn>

            <div className="grid gap-6 lg:gap-8 md:grid-cols-2">
                {equipmentCategories.map((category, idx) => (
                    <FadeIn key={idx} delay={idx * 0.05} className="h-full">
                        <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                            <div className="mb-6 flex items-center gap-4 border-b border-slate-200 pb-6">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                                    {category.icon}
                                </div>
                                <div>
                                    <h3 className="font-display text-xl font-semibold text-slate-900">{category.category}</h3>
                                    <p className="mt-1 text-sm text-slate-500">{category.items.length} Systems Deployed</p>
                                </div>
                            </div>
                            
                            <p className="mb-6 flex-grow text-sm leading-relaxed text-slate-600">
                                {category.description}
                            </p>

                            <div className="mt-auto space-y-3">
                                {category.items.map((item, itemIdx) => (
                                    <div key={itemIdx} className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:bg-slate-50">
                                        <div className="min-w-0 flex-1">
                                            <h4 className="truncate text-sm font-medium text-slate-900">{item.name}</h4>
                                            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                                                <Settings className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" /> {item.specs}
                                            </p>
                                        </div>
                                        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${getStatusTextClasses(item.status)}`}>
                                            {getStatusIcon(item.status)} {item.status}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </FadeIn>
                ))}
            </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="bg-white py-16 md:py-24 text-center">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <FadeIn>
              <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-slate-900">Ready to Build?</h2>
              <p className="mx-auto mt-4 max-w-md text-base sm:text-lg leading-relaxed text-slate-600">Your transformation from student to innovator starts here.</p>
              <Link to="/login" className="group mt-8 inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-brand-700">
                  GET STARTED <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
          </FadeIn>
        </div>
      </section>
    </div>
  );
};

export default Infrastructure;
