import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, CheckCircle2, Zap } from 'lucide-react';

const FEATURES = [
  {
    id: 1,
    tag: "Collaboration",
    title: "Interdisciplinary Ecosystem",
    description: "We shatter the walls between departments. Mechanical engineers work alongside artists, and computer scientists collaborate with biologists. This cross-pollination of ideas is where true innovation begins.",
    points: ["Open-plan co-working spaces", "Cross-domain faculty mentorship", "Student-led interest groups"],
    image: "/img/homepage/DSC_4720.JPG"
  },
  {
    id: 2,
    tag: "Infrastructure",
    title: "Industry 4.0 Ready",
    description: "Don't just read about the future—build it. Our lab is equipped with the latest industrial-grade machinery, ensuring that you graduate with hands-on experience on the tools that power the world.",
    points: ["5-Axis CNC Milling", "Industrial IoT Sensor Arrays", "AR/VR Development Studio"],
    image: "/img/homepage/DSC_4770.JPG"
  },
  {
    id: 3,
    tag: "Incubation",
    title: "From Idea to Enterprise",
    description: "The journey doesn't end at the prototype. Our dedicated incubation cell helps student entrepreneurs navigate the complex world of patents, funding, and go-to-market strategies.",
    points: ["Seed funding opportunities", "IP Rights guidance", "Investor networking events"],
    image: "/img/homepage/DSC09625.JPG"
  }
];

const AboutSlider: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const goToSlide = (index: number) => {
    if (isAnimating) return;
    setIsAnimating(true);
    setCurrentIndex(index);
    setTimeout(() => setIsAnimating(false), 500);
  };

  const nextSlide = () => goToSlide((currentIndex + 1) % FEATURES.length);
  const prevSlide = () => goToSlide((currentIndex - 1 + FEATURES.length) % FEATURES.length);

  useEffect(() => {
    const timer = setInterval(nextSlide, 6000);
    return () => clearInterval(timer);
  }, [currentIndex]);

  const currentFeature = FEATURES[currentIndex];

  return (
    <section className="bg-white py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-10 max-w-2xl md:mb-14">
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-600 sm:text-sm">
            <Zap className="h-4 w-4" aria-hidden="true" /> About The Lab
          </span>
          <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl lg:text-4xl">Center for Excellence</h2>
        </div>

        <div className="grid items-center gap-6 lg:grid-cols-2 lg:gap-8">
          
          {/* Content Side */}
          <div className={`space-y-6 transition-opacity duration-300 ${isAnimating ? 'opacity-50' : 'opacity-100'}`}>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-600/10">
              {currentFeature.tag}
            </span>
            
            <h3 className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {currentFeature.title}
            </h3>
            
            <p className="text-base leading-relaxed text-slate-600 sm:text-lg">
              {currentFeature.description}
            </p>

            <ul className="space-y-3">
              {currentFeature.points.map((point, idx) => (
                <li key={idx} className="flex items-center gap-3 text-base text-slate-700">
                  <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-brand-500" aria-hidden="true" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>

            {/* Controls */}
            <div className="flex items-center gap-6 pt-4">
              <div className="flex gap-2">
                <button 
                  onClick={prevSlide}
                  aria-label="Previous slide"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900"
                >
                  <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                </button>
                <button 
                  onClick={nextSlide}
                  aria-label="Next slide"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900"
                >
                  <ChevronRight className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
              
              {/* Progress Dots */}
              <div className="flex gap-2">
                {FEATURES.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => goToSlide(idx)}
                    aria-label={`Go to slide ${idx + 1}`}
                    aria-current={idx === currentIndex ? "true" : undefined}
                    className={`h-2 rounded-full transition-colors ${
                      idx === currentIndex ? 'w-8 bg-brand-600' : 'w-2 bg-slate-300 hover:bg-slate-400'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Image Side */}
          <div className="aspect-[4/3] w-full overflow-hidden rounded-2xl bg-slate-100">
            <img 
              src={currentFeature.image} 
              alt={currentFeature.title} 
              className={`h-full w-full object-cover transition-opacity duration-300 ${isAnimating ? 'opacity-80' : 'opacity-100'}`}
            />
          </div>

        </div>
      </div>
    </section>
  );
};

export default AboutSlider;
