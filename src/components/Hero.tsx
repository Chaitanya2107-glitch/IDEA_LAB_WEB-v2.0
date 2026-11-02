import React, { useState, useEffect } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const SLIDES = [
  {
    id: 1,
    image: 'img/homepage/DSC_4856.JPG',
    title: 'Innovation Redefined',
    subtitle: 'Where ideas meet execution'
  },
  {
    id: 2,
    image: 'img/homepage/DSC_4770.JPG',
    title: 'Future Ready',
    subtitle: 'Building the next generation of creators'
  },
  {
    id: 3,
    image: 'img/homepage/DSC_4720.JPG',
    title: 'Limitless Potential',
    subtitle: 'Explore the boundaries of science'
  },
  {
    id: 4,
    image: 'img/homepage/DSC_4782.JPG',
    title: 'Collaborative Ecosystem',
    subtitle: 'Uniting diverse minds for breakthrough solutions'
  },
  {
    id: 5,
    image: 'img/homepage/5.png',
    title: 'Advanced Fabrication',
    subtitle: 'State-of-the-art tools for rapid prototyping'
  }
];

const Hero: React.FC = () => {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % SLIDES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % SLIDES.length);
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + SLIDES.length) % SLIDES.length);

  return (
    <section className="relative h-[100svh] min-h-[560px] w-full overflow-hidden bg-slate-900">
      
      <AnimatePresence initial={false}>
        <motion.div
          key={currentSlide}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
          className="absolute inset-0"
        >
          <img 
            src={SLIDES[currentSlide].image} 
            alt={SLIDES[currentSlide].title} 
            loading={currentSlide === 0 ? "eager" : "lazy"}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/50 to-slate-950/30" />
        </motion.div>
      </AnimatePresence>

      {/* Content Layer */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative z-10 mx-auto flex h-full max-w-7xl flex-col items-center justify-center px-4 pt-16 text-center sm:px-6 lg:px-8"
      >
        <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white ring-1 ring-inset ring-white/20">
          Welcome to
        </span>

        <h1 className="mt-6 font-display text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
          REVA University
          <span className="block text-brand-400">
            AICTE IDEA LAB
          </span>
        </h1>

        <p className="mt-6 max-w-2xl text-lg text-slate-200 sm:text-xl">
          {SLIDES[currentSlide].subtitle}
        </p>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link to="/gallery" className="group inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-brand-700">
            Explore Gallery <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
          <Link to="/events" className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-6 py-3 text-base font-semibold text-slate-900 shadow-sm transition-colors hover:bg-slate-100">
            Upcoming Events
          </Link>
        </div>
      </motion.div>

      {/* Slider Controls */}
      <div className="absolute bottom-10 right-10 z-20 hidden gap-3 md:flex">
        <button onClick={prevSlide} aria-label="Previous slide" className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-inset ring-white/25 transition-colors hover:bg-white/20">
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <button onClick={nextSlide} aria-label="Next slide" className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-inset ring-white/25 transition-colors hover:bg-white/20">
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {/* Indicators */}
      <div className="absolute bottom-10 left-1/2 z-20 flex -translate-x-1/2 gap-2">
        {SLIDES.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentSlide(index)}
            aria-label={`Go to slide ${index + 1}`}
            aria-current={index === currentSlide ? "true" : undefined}
            className={`transition-colors ${
              index === currentSlide ? 'h-1.5 w-8 rounded-full bg-white' : 'h-1.5 w-4 rounded-full bg-white/40 hover:bg-white/70'
            }`}
          />
        ))}
      </div>
    </section>
  );
};

export default Hero;
