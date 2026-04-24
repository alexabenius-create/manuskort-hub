/**
 * CardBlockErrorBoundary — fångar render-fel inom CardBlockView och loggar
 * fullständig diagnostik (props, attrs) till konsolen samt visar fallback-UI.
 *
 * VIKTIGT: Fallback måste renderas inuti `NodeViewWrapper`, annars kraschar
 * Tiptap med "Please use the NodeViewWrapper component for your node view".
 */
import { Component, type ReactNode } from "react";
import { NodeViewWrapper } from "@tiptap/react";

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
    // eslint-disable-next-line no-console
    console.error("[CardBlockErrorBoundary] caught", {
      message: error.message,
      attrs: this.props.attrs,
      attrsKeys: Object.keys(this.props.attrs),
      info,
    });
  }

  render() {
    if (this.state.error) {
      return (
        <NodeViewWrapper
          as="article"
          data-card-block="true"
          className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 mb-4"
        >
          <p className="text-[12px] font-mono text-destructive">
            Render-fel i kort: {this.state.error.message}
          </p>
        </NodeViewWrapper>
      );
    }
    return this.props.children;
  }
}

