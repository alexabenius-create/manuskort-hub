/**
 * CardBlockErrorBoundary — fångar render-fel inom CardBlockView och loggar
 * fullständig diagnostik (props, attrs) till konsolen samt visar fallback-UI.
 *
 * Diagnostiskt verktyg: efter att roten är hittad ska denna kunna tas bort
 * eller behållas som permanent skydd mot felaktig nodedata.
 */
import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  attrs: Record<string, unknown>;
}

interface State {
  error: Error | null;
}

export class CardBlockErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    // Logga både props och attrs för att hitta fält som råkar vara objekt
    // eslint-disable-next-line no-console
    console.error("[CardBlockErrorBoundary] caught", {
      message: error.message,
      attrs: this.props.attrs,
      attrsKeys: Object.keys(this.props.attrs),
      attrsTypes: Object.fromEntries(
        Object.entries(this.props.attrs).map(([k, v]) => [
          k,
          v === null
            ? "null"
            : Array.isArray(v)
              ? "array"
              : typeof v === "object"
                ? `object{${Object.keys(v as object).join(",")}}`
                : typeof v,
        ]),
      ),
      info,
    });
  }

  render() {
    if (this.state.error) {
      return (
        <article
          data-card-block="true"
          className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 mb-4"
        >
          <p className="text-[12px] font-mono text-destructive">
            Render-fel i kort: {this.state.error.message}
          </p>
        </article>
      );
    }
    return this.props.children;
  }
}
