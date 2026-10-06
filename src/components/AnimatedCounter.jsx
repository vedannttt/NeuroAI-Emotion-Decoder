import React, { useEffect, useRef } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';

export default function AnimatedCounter({ value, duration = 1.2, suffix = '', prefix = '', decimals = 0 }) {
  const ref = useRef(null);
  const motionVal = useMotionValue(0);
  const spring = useSpring(motionVal, { duration: duration * 1000, bounce: 0 });

  useEffect(() => {
    const parsed = parseFloat(String(value).replace(/[^0-9.]/g, '')) || 0;
    motionVal.set(parsed);
  }, [value, motionVal]);

  useEffect(() => {
    const unsubscribe = spring.on('change', (latest) => {
      if (ref.current) {
        const formatted = latest.toFixed(decimals);
        ref.current.textContent = `${prefix}${formatted}${suffix}`;
      }
    });
    return unsubscribe;
  }, [spring, prefix, suffix, decimals]);

  const displayValue = typeof value === 'string' && /[a-zA-Z]/.test(value) ? value : `${prefix}0${suffix}`;

  return <span ref={ref}>{displayValue}</span>;
}
