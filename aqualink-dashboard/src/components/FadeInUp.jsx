import { useEffect, useRef, useState } from "react";

function FadeInUp({ children, className = "", delay = 0 }) {
  const elementRef = useRef(null);
  const [isVisible, setIsVisible] = useState(() =>
    typeof window !== "undefined" &&
    (window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !("IntersectionObserver" in window)),
  );

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return undefined;

    if (isVisible) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.05, rootMargin: "0px 0px -20px" },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [isVisible]);

  return (
    <div
      ref={elementRef}
      className={`fade-in-up ${isVisible ? "is-visible" : ""} ${className}`.trim()}
      style={{ "--reveal-delay": `${delay}ms` }}
    >
      {children}
    </div>
  );
}

export default FadeInUp;
