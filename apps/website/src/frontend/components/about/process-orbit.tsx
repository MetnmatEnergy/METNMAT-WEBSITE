"use client";

import { Lightbulb, DraftingCompass, FlaskConical, TrendingUp, Factory } from "lucide-react";
import RadialOrbitalTimeline, { type OrbitalItem } from "@/frontend/components/ui/radial-orbital-timeline";

/**
 * METNMAT's concept→scale-up process as an interactive orbital. Lives in a client
 * component because the lucide icon components can't be passed from a server
 * component across the boundary.
 */
const processData: OrbitalItem[] = [
  {
    id: 1,
    title: "Concept",
    date: "Stage 01",
    category: "Discovery",
    icon: Lightbulb,
    relatedIds: [2],
    energy: 100,
    content: "We map your technical requirement and the real process challenge behind it.",
  },
  {
    id: 2,
    title: "Design",
    date: "Stage 02",
    category: "Engineering",
    icon: DraftingCompass,
    relatedIds: [1, 3],
    energy: 88,
    content: "We design the experiment, material or system — grounded in science and engineering.",
  },
  {
    id: 3,
    title: "Validation",
    date: "Stage 03",
    category: "Lab & Pilot",
    icon: FlaskConical,
    relatedIds: [2, 4],
    energy: 72,
    content: "We build and test at lab and pilot scale until the result is proven and repeatable.",
  },
  {
    id: 4,
    title: "Scale-up",
    date: "Stage 04",
    category: "Industrial",
    icon: TrendingUp,
    relatedIds: [3, 5],
    energy: 60,
    content: "We take the validated solution to cost-effective, reliable industrial implementation.",
  },
  {
    id: 5,
    title: "Delivery",
    date: "Stage 05",
    category: "Turnkey",
    icon: Factory,
    relatedIds: [4],
    energy: 48,
    content: "We hand over a working, scalable result — with the knowledge to run and grow it.",
  },
];

export function ProcessOrbit() {
  return <RadialOrbitalTimeline timelineData={processData} />;
}
