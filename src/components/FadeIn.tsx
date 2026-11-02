import React from 'react';
import { motion } from 'framer-motion';

interface FadeInProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  viewportMargin?: string;
}

export const FadeIn: React.FC<FadeInProps> = ({ 
  children, 
  delay = 0, 
  className = "", 
  viewportMargin = "-80px" 
}) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: viewportMargin }}
    transition={{ duration: 0.4, delay: Math.min(delay, 0.3), ease: "easeOut" }}
    className={className}
  >
    {children}
  </motion.div>
);
