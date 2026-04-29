/**
 * CardBlockErrorBoundary — fångar render-fel inom CardBlockView.
 */
import { Component, type ReactNode } from "react";
import { NodeViewWrapper } from "@tiptap/react";
import { useTranslation } from "react-i18next";

interface Props {
  children: ReactNode;
  attrs: Record<string, unknown>;
}

interface State {
  error: Error | null;
}

function ErrorFallback({ message }: { message: string }) {
  const { t } = useTranslation();
  return (
    <NodeViewWrapper
      as="article"
      data-card-block="true"
      className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 mb-4"
    >
      <p className="text-[12px] font-mono text-destructive">
        {t("editor.card.render_error", { message })}
      </p>
    </NodeViewWrapper>
  );
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
      return <ErrorFallback message={this.state.error.message} />;
    }
    return this.props.children;
  }
}
