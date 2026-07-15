"use client";

import { useState, useEffect, useRef } from "react";
import { ArrowRight, Link as LinkIcon, Gauge } from "lucide-react";
import { cn } from "@/frontend/lib/utils";

export interface OrbitalItem {
  id: number;
  title: string;
  date: string;
  content: string;
  category: string;
  icon: React.ElementType;
  relatedIds: number[];
  energy: number;
}

interface RadialOrbitalTimelineProps {
  timelineData: OrbitalItem[];
}

/**
 * Brand-adapted radial orbital timeline. Nodes orbit a central METNMAT mark;
 * tapping a node pauses rotation, expands its detail and highlights related
 * nodes. Containerized (not full-screen) and recolored to the METNMAT red/dark
 * theme. Self-contained — lucide icons + cn only.
 */
export default function RadialOrbitalTimeline({ timelineData }: RadialOrbitalTimelineProps) {
  const [expandedItems, setExpandedItems] = useState<Record<number, boolean>>({});
  const [rotationAngle, setRotationAngle] = useState<number>(0);
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [pulseEffect, setPulseEffect] = useState<Record<number, boolean>>({});
  const [activeNodeId, setActiveNodeId] = useState<number | null>(null);
  const [radius, setRadius] = useState<number>(180);
  const containerRef = useRef<HTMLDivElement>(null);
  const orbitRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === containerRef.current || e.target === orbitRef.current) {
      setExpandedItems({});
      setActiveNodeId(null);
      setPulseEffect({});
      setAutoRotate(true);
    }
  };

  const toggleItem = (id: number) => {
    setExpandedItems((prev) => {
      const newState: Record<number, boolean> = {};
      Object.keys(prev).forEach((key) => {
        newState[parseInt(key)] = false;
      });
      newState[id] = !prev[id];

      if (!prev[id]) {
        setActiveNodeId(id);
        setAutoRotate(false);
        const relatedItems = getRelatedItems(id);
        const newPulse: Record<number, boolean> = {};
        relatedItems.forEach((relId) => (newPulse[relId] = true));
        setPulseEffect(newPulse);
        centerViewOnNode(id);
      } else {
        setActiveNodeId(null);
        setAutoRotate(true);
        setPulseEffect({});
      }
      return newState;
    });
  };

  useEffect(() => {
    let rotationTimer: ReturnType<typeof setInterval>;
    if (autoRotate) {
      rotationTimer = setInterval(() => {
        setRotationAngle((prev) => Number(((prev + 0.3) % 360).toFixed(3)));
      }, 50);
    }
    return () => {
      if (rotationTimer) clearInterval(rotationTimer);
    };
  }, [autoRotate]);

  // Keep the orbit radius inside the container so nodes never clip on mobile.
  useEffect(() => {
    const update = () => {
      const w = containerRef.current?.offsetWidth ?? 600;
      setRadius(Math.max(110, Math.min(190, w / 2 - 70)));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const centerViewOnNode = (nodeId: number) => {
    if (!nodeRefs.current[nodeId]) return;
    const nodeIndex = timelineData.findIndex((item) => item.id === nodeId);
    const total = timelineData.length;
    const targetAngle = (nodeIndex / total) * 360;
    setRotationAngle(270 - targetAngle);
  };

  const calculateNodePosition = (index: number, total: number) => {
    const angle = ((index / total) * 360 + rotationAngle) % 360;
    const radian = (angle * Math.PI) / 180;
    const x = radius * Math.cos(radian);
    const y = radius * Math.sin(radian);
    const zIndex = Math.round(100 + 50 * Math.cos(radian));
    const opacity = Math.max(0.4, Math.min(1, 0.4 + 0.6 * ((1 + Math.sin(radian)) / 2)));
    return { x, y, zIndex, opacity };
  };

  const getRelatedItems = (itemId: number): number[] => {
    const currentItem = timelineData.find((item) => item.id === itemId);
    return currentItem ? currentItem.relatedIds : [];
  };

  const isRelatedToActive = (itemId: number): boolean => {
    if (!activeNodeId) return false;
    return getRelatedItems(activeNodeId).includes(itemId);
  };

  return (
    <div
      className="relative h-[600px] w-full overflow-hidden rounded-3xl border border-border bg-[#0a0a0f]"
      ref={containerRef}
      onClick={handleContainerClick}
    >
      {/* subtle brand wash */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_50%,hsl(var(--brand)/0.16),transparent_70%)]" />

      <div className="relative flex h-full w-full items-center justify-center">
        <div
          className="absolute flex h-full w-full items-center justify-center"
          ref={orbitRef}
          style={{ perspective: "1000px" }}
        >
          {/* Center mark */}
          <div className="absolute z-10 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-brand via-brand to-orange-500 animate-pulse">
            <div className="absolute h-20 w-20 animate-ping rounded-full border border-brand/30 opacity-70" />
            <div
              className="absolute h-24 w-24 animate-ping rounded-full border border-brand/20 opacity-50"
              style={{ animationDelay: "0.5s" }}
            />
            <span className="font-display text-sm font-bold text-white">M</span>
          </div>

          <div
            className="absolute rounded-full border border-white/10"
            style={{ width: radius * 2, height: radius * 2 }}
          />

          {timelineData.map((item, index) => {
            const position = calculateNodePosition(index, timelineData.length);
            const isExpanded = expandedItems[item.id];
            const isRelated = isRelatedToActive(item.id);
            const isPulsing = pulseEffect[item.id];
            const Icon = item.icon;

            const nodeStyle = {
              transform: `translate(${position.x}px, ${position.y}px)`,
              zIndex: isExpanded ? 200 : position.zIndex,
              opacity: isExpanded ? 1 : position.opacity,
            };

            return (
              <div
                key={item.id}
                ref={(el) => {
                  nodeRefs.current[item.id] = el;
                }}
                role="button"
                tabIndex={0}
                aria-expanded={!!isExpanded}
                aria-label={`${item.title} — ${item.category}, stage maturity ${item.energy}%. ${item.content}`}
                className="absolute cursor-pointer rounded-full transition-all duration-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0f]"
                style={nodeStyle}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleItem(item.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleItem(item.id);
                  }
                }}
              >
                <div
                  className={cn("absolute rounded-full -inset-1", isPulsing && "animate-pulse duration-1000")}
                  style={{
                    background: "radial-gradient(circle, hsl(var(--brand)/0.25) 0%, transparent 70%)",
                    width: `${item.energy * 0.5 + 40}px`,
                    height: `${item.energy * 0.5 + 40}px`,
                    left: `-${(item.energy * 0.5) / 2}px`,
                    top: `-${(item.energy * 0.5) / 2}px`,
                  }}
                />

                <div
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-full border-2 transition-all duration-300",
                    isExpanded
                      ? "scale-125 border-brand bg-brand text-white shadow-lg shadow-brand/40"
                      : isRelated
                        ? "animate-pulse border-white bg-white/20 text-white"
                        : "border-white/40 bg-white/5 text-white"
                  )}
                >
                  <Icon size={18} />
                </div>

                <div
                  className={cn(
                    "absolute top-14 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-semibold tracking-wide transition-all duration-300",
                    isExpanded ? "scale-110 text-white" : "text-white/70"
                  )}
                >
                  {item.title}
                </div>

                {isExpanded && (
                  <div className="absolute top-24 left-1/2 w-64 -translate-x-1/2 overflow-visible rounded-2xl border border-white/15 bg-[#0a0a0f]/95 p-4 shadow-xl shadow-black/40 backdrop-blur-lg">
                    <div className="absolute -top-3 left-1/2 h-3 w-px -translate-x-1/2 bg-white/30" />
                    <div className="flex items-center justify-between">
                      <span className="rounded-full border border-brand/40 bg-brand/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-soft">
                        {item.category}
                      </span>
                      <span className="font-mono text-[10px] text-white/50">{item.date}</span>
                    </div>
                    <h4 className="mt-2 font-display text-sm font-semibold text-white">{item.title}</h4>
                    <p className="mt-1.5 text-xs leading-relaxed text-white/75">{item.content}</p>

                    <div className="mt-3 border-t border-white/10 pt-3">
                      <div className="mb-1 flex items-center justify-between text-[11px] text-white/70">
                        <span className="flex items-center gap-1">
                          <Gauge size={11} /> Maturity
                        </span>
                        <span className="font-mono">{item.energy}%</span>
                      </div>
                      <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-brand to-orange-400"
                          style={{ width: `${item.energy}%` }}
                        />
                      </div>
                    </div>

                    {item.relatedIds.length > 0 && (
                      <div className="mt-3 border-t border-white/10 pt-3">
                        <div className="mb-2 flex items-center text-[10px] uppercase tracking-wider text-white/60">
                          <LinkIcon size={10} className="mr-1" /> Related stages
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {item.relatedIds.map((relatedId) => {
                            const related = timelineData.find((i) => i.id === relatedId);
                            return (
                              <button
                                key={relatedId}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleItem(relatedId);
                                }}
                                className="flex items-center gap-1 rounded-full border border-white/20 px-2 py-0.5 text-[10px] text-white/80 transition-all hover:bg-white/10 hover:text-white"
                              >
                                {related?.title}
                                <ArrowRight size={9} className="text-white/60" />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <p className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 text-center text-[11px] text-white/40">
        Tap a stage to explore · tap the center to reset
      </p>
    </div>
  );
}
