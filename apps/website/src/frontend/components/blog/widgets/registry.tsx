"use client";

/**
 * Widget id → component. Each widget is its own `next/dynamic` chunk, so an
 * article downloads only the code of the models it actually contains, and
 * articles without one download none. The config arriving here has already
 * passed its zod schema on the server (lib/widgets/schemas.ts is imported for
 * its TYPES only, so zod never reaches the browser).
 *
 * An error boundary turns a crash inside a widget into the same visible
 * "model unavailable" panel as a bad config, instead of taking the article
 * page down with it.
 */
import React from "react";
import dynamic from "next/dynamic";
import type { ValidWidget } from "@/frontend/lib/widgets/schemas";
import { ModelUnavailable } from "./model-unavailable";

const Loading = () => <div aria-hidden className="h-[26rem] animate-pulse rounded-xl bg-muted/50" />;

const Ellingham = dynamic(() => import("./ellingham").then((m) => m.EllinghamWidget), { loading: Loading });
const CyclicVoltammetry = dynamic(() => import("./cyclic-voltammetry").then((m) => m.CyclicVoltammetryWidget), {
  loading: Loading,
});
const FunctionPlot = dynamic(() => import("./function-plot").then((m) => m.FunctionPlotWidget), { loading: Loading });
const Pourbaix = dynamic(() => import("./pourbaix").then((m) => m.PourbaixWidget), { loading: Loading });

class WidgetBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error("[blog widget] render failed", error);
  }
  render() {
    return this.state.failed ? <ModelUnavailable issues={["the model hit an error while drawing"]} /> : this.props.children;
  }
}

export function WidgetMount(props: ValidWidget) {
  let el: React.ReactNode;
  switch (props.widget) {
    case "ellingham":
      el = <Ellingham config={props.config} />;
      break;
    case "cyclic-voltammetry":
      el = <CyclicVoltammetry config={props.config} />;
      break;
    case "function-plot":
      el = <FunctionPlot config={props.config} />;
      break;
    case "pourbaix":
      el = <Pourbaix config={props.config} />;
      break;
  }
  return <WidgetBoundary>{el}</WidgetBoundary>;
}
