import { useEffect, useRef, useState } from "react";
import { Tag, FileText, Target } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { TopicAreaPicker } from "./TopicAreaPicker";
import { IssueUpload } from "./IssueUpload";
import { RoleSelector } from "./RoleSelector";
import { cn } from "@/lib/utils";

interface DebateThread {
  id: string;
  title: string;
  topic_area: string;
  issue_text: string;
  issue_document_text: string;
  issue_document_filename: string | null;
  own_position: string;
  user_role: "speaker" | "replier";
}

interface Props {
  thread: DebateThread;
  onChanged: (patch: Partial<DebateThread>) => void;
  showRoleSelector?: boolean;
}

export function ThreadHeader({ thread, onChanged, showRoleSelector }: Props) {
  const [title, setTitle] = useState(thread.title);
  const [topicArea, setTopicArea] = useState(thread.topic_area);
  const [issueText, setIssueText] = useState(thread.issue_text);
  const [ownPosition, setOwnPosition] = useState(thread.own_position);
  const [issueOpen, setIssueOpen] = useState(
    Boolean(thread.issue_text || thread.issue_document_filename),
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Synka om tråden ändras utifrån (refetch)
  useEffect(() => {
    setTitle(thread.title);
    setTopicArea(thread.topic_area);
    setIssueText(thread.issue_text);
    setOwnPosition(thread.own_position);
  }, [thread.id, thread.title, thread.topic_area, thread.issue_text, thread.own_position]);

  const persist = async (patch: Partial<DebateThread>) => {
    const { error } = await supabase
      .from("debate_threads")
      .update(patch)
      .eq("id", thread.id);
    if (!error) onChanged(patch);
  };

  const debouncedPersist = (patch: Partial<DebateThread>, delay = 500) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => persist(patch), delay);
  };

  return (
    <section className="space-y-4">
      {/* Titel */}
      <input
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          debouncedPersist({ title: e.target.value });
        }}
        placeholder="Ge debatten ett namn…"
        className="w-full font-display text-3xl font-semibold tracking-tight text-v2-ink bg-transparent border-0 outline-none focus:bg-v2-surface focus:rounded-lg focus:px-2 transition-all"
        maxLength={120}
      />

      {/* Roll-väljare (visas bara innan första turen) */}
      {showRoleSelector && (
        <RoleSelector
          value={thread.user_role}
          onChange={(role) => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            persist({ user_role: role });
          }}
        />
      )}

      {/* Sakområde */}
      <div className="rounded-2xl bg-white border border-v2-line p-5">
        <TopicAreaPicker
          value={topicArea}
          onChange={(next, opts) => {
            setTopicArea(next);
            if (opts?.flushNow) {
              if (debounceRef.current) clearTimeout(debounceRef.current);
              persist({ topic_area: next });
            } else {
              debouncedPersist({ topic_area: next });
            }
          }}
        />
      </div>

      {/* Ärende */}
      <Collapsible open={issueOpen} onOpenChange={setIssueOpen}>
        <div className={cn("rounded-2xl border transition-colors", issueOpen ? "bg-white border-v2-line" : "bg-white/60 border-v2-line hover:border-v2-violet/40")}>
          <CollapsibleTrigger className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left">
            <div className="flex items-center gap-3">
              <FileText className="h-4 w-4 text-v2-violet shrink-0" />
              <div>
                <div className="text-[14px] font-semibold text-v2-ink">Ärende</div>
                <div className="text-[12px] text-v2-muted">
                  {thread.issue_document_filename
                    ? `📎 ${thread.issue_document_filename}`
                    : issueText
                    ? `${issueText.slice(0, 80)}${issueText.length > 80 ? "…" : ""}`
                    : "Valfritt – ladda upp dokument eller beskriv i text"}
                </div>
              </div>
            </div>
            <ChevronDown className={cn("h-4 w-4 text-v2-muted transition-transform", issueOpen && "rotate-180")} />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-5 pb-5 space-y-3">
              <IssueUpload
                loadedFileName={thread.issue_document_filename}
                onParsed={({ summary, fullText, fileName }) => {
                  const nextIssue = issueText.trim() ? issueText : summary;
                  setIssueText(nextIssue);
                  if (debounceRef.current) clearTimeout(debounceRef.current);
                  persist({
                    issue_document_text: fullText,
                    issue_document_filename: fileName,
                    issue_text: nextIssue,
                  });
                }}
                onCleared={() => {
                  if (debounceRef.current) clearTimeout(debounceRef.current);
                  persist({ issue_document_text: "", issue_document_filename: null });
                }}
              />
              <Textarea
                value={issueText}
                onChange={(e) => {
                  setIssueText(e.target.value);
                  debouncedPersist({ issue_text: e.target.value });
                }}
                placeholder="…eller beskriv ärendet i fritext (motion, budgetförslag, paragraf)."
                rows={3}
                className="rounded-xl"
              />
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Min ståndpunkt */}
      <div className="rounded-2xl bg-white border border-v2-line p-5 space-y-2">
        <div className="flex items-baseline justify-between">
          <label className="text-[13px] font-semibold text-v2-ink inline-flex items-center gap-2">
            <Target className="h-3.5 w-3.5 text-v2-violet" />
            Min ståndpunkt
          </label>
          <span className="text-[11px] text-v2-muted">AI använder detta för att hitta skiljelinjen</span>
        </div>
        <Textarea
          value={ownPosition}
          onChange={(e) => {
            setOwnPosition(e.target.value);
            debouncedPersist({ own_position: e.target.value });
          }}
          placeholder="Beskriv kort vad du står för i den här frågan…"
          rows={4}
          className="rounded-xl"
        />
        <div className="text-right text-[11px] text-v2-muted">{ownPosition.length} tecken</div>
      </div>
    </section>
  );
}
