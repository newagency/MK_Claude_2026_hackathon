import { useState, useEffect, useRef, useCallback } from "react";
import {
  Newspaper,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Minus,
  ExternalLink,
  Send,
  Bot,
  User,
  Loader2,
  Sparkles,
  ShieldCheck,
  Zap,
  Package,
  MessageCircle,
} from "lucide-react";

const IMPACT_STYLE = {
  up: { label: "상승 압력", color: "var(--risk-high)", bg: "var(--risk-high-bg)", Icon: TrendingUp },
  down: { label: "하락 요인", color: "var(--risk-low)", bg: "var(--risk-low-bg)", Icon: TrendingDown },
  unstable: { label: "불안정", color: "var(--risk-med)", bg: "var(--risk-med-bg)", Icon: Minus },
};

const COMMODITY_COLOR = {
  계란: "#f59e0b",
  돼지: "#ec4899",
  사과: "#ef4444",
  쌀: "#84cc16",
  천일염: "#06b6d4",
  피마늘: "#8b5cf6",
};

const fmtDate = (d) => {
  if (!(d instanceof Date)) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};

/* ── News Card ─────────────────────────────────────────────── */
const NewsCard = ({ match, onAsk }) => {
  const impact = IMPACT_STYLE[match.impact] || IMPACT_STYLE.unstable;
  const ImpactIcon = impact.Icon;

  return (
    <div
      className="rounded-xl p-3.5 transition-all duration-200 hover:-translate-y-0.5"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-xs font-bold leading-snug line-clamp-2" style={{ color: "var(--text-h)" }}>
          {match.title}
        </h3>
        {match.url && (
          <a href={match.url} target="_blank" rel="noreferrer" className="shrink-0 p-1 rounded transition-colors hover:bg-gray-100" style={{ color: "var(--text)" }}>
            <ExternalLink size={12} />
          </a>
        )}
      </div>

      {match.summary && (
        <p className="text-[11px] leading-relaxed mb-2 line-clamp-2" style={{ color: "var(--text)" }}>
          {match.summary}
        </p>
      )}

      <div className="flex items-center flex-wrap gap-1 mb-2">
        <span className="inline-flex items-center gap-0.5 px-1.5 py-px rounded-full text-[10px] font-semibold" style={{ background: impact.bg, color: impact.color }}>
          <ImpactIcon size={9} strokeWidth={3} />
          {impact.label}
        </span>
        <span
          className="inline-flex items-center gap-0.5 px-1.5 py-px rounded-full text-[10px] font-semibold"
          style={{
            background: match.severity >= 7 ? "var(--risk-high-bg)" : match.severity >= 4 ? "var(--risk-med-bg)" : "var(--risk-low-bg)",
            color: match.severity >= 7 ? "var(--risk-high)" : match.severity >= 4 ? "var(--risk-med)" : "var(--risk-low)",
          }}
        >
          심각도 {match.severity}
        </span>
        {(match.matched_commodities || []).map((c) => (
          <span
            key={c}
            className="px-1.5 py-px rounded-full text-[10px] font-semibold"
            style={{ background: `${COMMODITY_COLOR[c] || "#6366f1"}18`, color: COMMODITY_COLOR[c] || "#6366f1", border: `1px solid ${COMMODITY_COLOR[c] || "#6366f1"}30` }}
          >
            {c}
          </span>
        ))}
      </div>

      {match.reason && (
        <p className="text-[11px] leading-relaxed mb-2" style={{ color: "var(--text)", opacity: 0.8 }}>
          {match.reason}
        </p>
      )}

      <button
        onClick={() => onAsk(match)}
        className="flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-md transition-all hover:shadow-sm"
        style={{ background: "var(--accent-bg)", color: "var(--accent)", border: "1px solid var(--accent-border)" }}
      >
        <MessageCircle size={10} />
        질문하기
      </button>
    </div>
  );
};

/* ── Suggested Questions ────────────────────────────────────── */
const SUGGESTED_QUESTIONS = [
  { icon: TrendingUp, text: "오늘 가격에 가장 큰 영향을 주는 뉴스는?" },
  { icon: ShieldCheck, text: "지금 당장 해야 할 조치가 있어?" },
  { icon: Package, text: "이번 주 발주 전략을 추천해줘" },
  { icon: Zap, text: "그리드플레이션 의심되는 품목 있어?" },
];

const SuggestedChips = ({ onSelect, visible }) => {
  if (!visible) return null;
  return (
    <div className="flex flex-wrap gap-2 px-1 pb-2">
      {SUGGESTED_QUESTIONS.map((q, i) => {
        const Icon = q.icon;
        return (
          <button
            key={i}
            onClick={() => onSelect(q.text)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all hover:-translate-y-0.5 hover:shadow-sm"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              color: "var(--text-h)",
            }}
          >
            <Icon size={12} style={{ color: "var(--accent)" }} />
            {q.text}
          </button>
        );
      })}
    </div>
  );
};

/* ── Chat Bubble ────────────────────────────────────────────── */
const ChatBubble = ({ msg }) => {
  const isUser = msg.role === "user";
  return (
    <div className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5"
        style={{
          background: isUser ? "var(--accent)" : "var(--accent-bg)",
          color: isUser ? "#fff" : "var(--accent)",
        }}
      >
        {isUser ? <User size={13} /> : <Bot size={13} />}
      </div>
      <div
        className="max-w-[80%] px-4 py-2.5 rounded-2xl text-[13px] leading-relaxed whitespace-pre-wrap"
        style={{
          background: isUser ? "var(--accent)" : "var(--bg-card)",
          color: isUser ? "#fff" : "var(--text-h)",
          border: isUser ? "none" : "1px solid var(--border)",
          borderTopRightRadius: isUser ? 4 : 16,
          borderTopLeftRadius: isUser ? 16 : 4,
        }}
      >
        {msg.content}
      </div>
    </div>
  );
};

/* ActionPanel removed — actions are inlined in the 3-column layout */

/* ── Main Component ─────────────────────────────────────────── */
const LinkAuditor = ({ selectedDate }) => {
  const safeDate = selectedDate instanceof Date ? selectedDate : new Date(2025, 9, 2);
  const dateStr = fmtDate(safeDate);

  const [newsMatches, setNewsMatches] = useState([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [actionItems, setActionItems] = useState([]);
  const [briefLoading, setBriefLoading] = useState(false);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);

  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  useEffect(() => {
    setMessages([]);
    setShowSuggestions(true);
    setNewsMatches([]);
    setActionItems([]);

    const ctrl = new AbortController();

    setNewsLoading(true);
    fetch(`/api/v1/news/daily?date=${dateStr}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => { setNewsMatches(d.matches || []); setNewsLoading(false); })
      .catch((e) => { if (e.name !== "AbortError") setNewsLoading(false); });

    setBriefLoading(true);
    fetch(`/api/v1/news/brief?date=${dateStr}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => {
        const items = [];
        for (const brief of Object.values(d.briefs || {})) {
          for (const a of brief.action_items || []) {
            items.push({ ...a, commodity: brief.commodity_name });
          }
        }
        items.sort((a, b) => {
          const ord = { high: 0, medium: 1, low: 2 };
          return (ord[a.urgency] ?? 3) - (ord[b.urgency] ?? 3);
        });
        setActionItems(items);
        setBriefLoading(false);
      })
      .catch((e) => { if (e.name !== "AbortError") setBriefLoading(false); });

    return () => ctrl.abort();
  }, [dateStr]);

  const sendMessage = async (text) => {
    if (!text.trim()) return;
    const userMsg = { role: "user", content: text.trim() };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setShowSuggestions(false);
    setChatLoading(true);

    try {
      const res = await fetch("/api/v1/news/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text.trim(),
          date: dateStr,
          conversation_history: updated.slice(-10),
        }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.answer }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "죄송합니다, 일시적인 오류가 발생했습니다. 다시 시도해주세요." }]);
    }
    setChatLoading(false);
    inputRef.current?.focus();
  };

  const handleAskAboutNews = (match) => {
    const q = `"${match.title}" 이 뉴스가 소상공인에게 미치는 실질적인 영향과 대응 방안을 알려줘`;
    sendMessage(q);
  };

  const handleAskAboutAction = (action) => {
    const q = `"${action.title}" 이 액션 아이템을 구체적으로 어떻게 실행하면 좋을까?`;
    sendMessage(q);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const highCount = newsMatches.filter((m) => m.severity >= 7).length;
  const medCount = newsMatches.filter((m) => m.severity >= 4 && m.severity < 7).length;

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div className="max-w-6xl mx-auto px-5 relative z-10">
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--accent)" }}>
            AI 뉴스 인사이트
          </p>
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <h1 className="text-xl font-black tracking-tight" style={{ color: "var(--text-h)" }}>
              오늘의 뉴스 브리핑
            </h1>
            <div className="flex flex-wrap gap-1.5">
              {highCount > 0 && (
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: "var(--risk-high-bg)", color: "var(--risk-high)" }}>
                  <AlertTriangle size={11} strokeWidth={3} /> 고위험 {highCount}건
                </div>
              )}
              {medCount > 0 && (
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: "var(--risk-med-bg)", color: "var(--risk-med)" }}>
                  <AlertCircle size={11} strokeWidth={3} /> 주의 {medCount}건
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content: 3-section layout */}
      <div className="max-w-7xl mx-auto px-5 py-5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4" style={{ height: "calc(100vh - 260px)" }}>

          {/* Left: Action Items (own scroll) */}
          <div className="lg:col-span-3 flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 px-1 pb-2.5">
              <Zap size={13} style={{ color: "var(--accent)" }} />
              <span className="text-xs font-bold" style={{ color: "var(--text-h)" }}>액션 아이템</span>
              {actionItems.length > 0 && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: "var(--accent-bg)", color: "var(--accent)" }}>
                  {actionItems.length}
                </span>
              )}
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {briefLoading ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                  <Loader2 size={12} className="animate-spin" style={{ color: "var(--accent)" }} />
                  <span className="text-[11px]" style={{ color: "var(--text)" }}>분석 중...</span>
                </div>
              ) : actionItems.length === 0 ? (
                <div className="text-center py-8 rounded-xl" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                  <Zap size={24} className="mx-auto mb-2" style={{ color: "var(--border)" }} />
                  <p className="text-[11px]" style={{ color: "var(--text)", opacity: 0.5 }}>액션 아이템 없음</p>
                </div>
              ) : (
                actionItems.map((a, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2.5 p-3 rounded-xl transition-all duration-200 hover:-translate-y-0.5"
                    style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "0 1px 4px rgba(0,0,0,0.03)" }}
                  >
                    <div
                      className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black mt-0.5"
                      style={{
                        background: a.urgency === "high" ? "var(--risk-high-bg)" : a.urgency === "medium" ? "var(--risk-med-bg)" : "var(--accent-bg)",
                        color: a.urgency === "high" ? "var(--risk-high)" : a.urgency === "medium" ? "var(--risk-med)" : "var(--accent)",
                      }}
                    >
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold mb-0.5 leading-snug" style={{ color: "var(--text-h)" }}>{a.title}</p>
                      <p className="text-[10px] leading-relaxed line-clamp-2" style={{ color: "var(--text)" }}>{a.detail}</p>
                    </div>
                    <button
                      onClick={() => handleAskAboutAction(a)}
                      className="shrink-0 p-1 rounded-md transition-colors"
                      style={{ color: "var(--accent)" }}
                      title="질문하기"
                    >
                      <MessageCircle size={11} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Middle: News list (own scroll) */}
          <div className="lg:col-span-5 flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 px-1 pb-2.5">
              <Newspaper size={13} style={{ color: "var(--accent)" }} />
              <span className="text-xs font-bold" style={{ color: "var(--text-h)" }}>관련 뉴스</span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: "var(--accent-bg)", color: "var(--accent)" }}>
                {newsMatches.length}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
              {newsLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="rounded-xl p-3.5 animate-pulse" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                    <div className="h-3.5 rounded mb-2.5" style={{ background: "var(--border)", width: "80%" }} />
                    <div className="h-2.5 rounded mb-1.5" style={{ background: "var(--border)", width: "100%" }} />
                    <div className="h-2.5 rounded" style={{ background: "var(--border)", width: "60%" }} />
                  </div>
                ))
              ) : newsMatches.length === 0 ? (
                <div className="text-center py-10 rounded-xl" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                  <Newspaper size={28} className="mx-auto mb-2" style={{ color: "var(--border)" }} />
                  <p className="text-xs font-medium" style={{ color: "var(--text)" }}>해당 날짜에 관련 뉴스가 없습니다</p>
                </div>
              ) : (
                newsMatches.map((m, i) => (
                  <NewsCard key={m.article_id || i} match={m} onAsk={handleAskAboutNews} />
                ))
              )}
            </div>
          </div>

          {/* Right: Chat interface (narrower) */}
          <div
            className="lg:col-span-4 rounded-2xl flex flex-col overflow-hidden"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
          >
            {/* Chat header */}
            <div className="px-5 py-3.5 flex items-center gap-3" style={{ borderBottom: "1px solid var(--border)" }}>
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, var(--accent-soft), var(--accent))" }}
              >
                <Bot size={16} color="#fff" />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: "var(--text-h)" }}>소상 AI 어시스턴트</p>
                <p className="text-[11px]" style={{ color: "var(--text)", opacity: 0.6 }}>
                  오늘의 뉴스에 대해 무엇이든 물어보세요
                </p>
              </div>
              {newsMatches.length > 0 && (
                <span
                  className="ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: "var(--risk-low-bg)", color: "var(--risk-low)" }}
                >
                  {newsMatches.length}건 분석 완료
                </span>
              )}
            </div>

            {/* Chat messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4" style={{ background: "var(--bg-subtle)" }}>
              {messages.length === 0 && !chatLoading && (
                <div className="text-center py-8">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                    style={{ background: "linear-gradient(135deg, var(--accent-soft), var(--accent))" }}
                  >
                    <Sparkles size={24} color="#fff" />
                  </div>
                  <p className="text-sm font-bold mb-1" style={{ color: "var(--text-h)" }}>
                    무엇이 궁금하신가요?
                  </p>
                  <p className="text-xs" style={{ color: "var(--text)" }}>
                    왼쪽 뉴스에 대해 질문하거나, 아래 추천 질문을 눌러보세요
                  </p>
                </div>
              )}

              {messages.map((m, i) => (
                <ChatBubble key={i} msg={m} />
              ))}

              {chatLoading && (
                <div className="flex gap-2.5">
                  <div
                    className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
                    style={{ background: "var(--accent-bg)", color: "var(--accent)" }}
                  >
                    <Bot size={13} />
                  </div>
                  <div
                    className="px-4 py-3 rounded-2xl"
                    style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderTopLeftRadius: 4 }}
                  >
                    <div className="flex items-center gap-2">
                      <Loader2 size={13} className="animate-spin" style={{ color: "var(--accent)" }} />
                      <span className="text-xs" style={{ color: "var(--text)" }}>생각하는 중...</span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Suggested questions */}
            <div className="px-4 pt-3" style={{ background: "var(--bg-subtle)", borderTop: "1px solid var(--border)" }}>
              <SuggestedChips onSelect={sendMessage} visible={showSuggestions && newsMatches.length > 0 && messages.length === 0} />
            </div>

            {/* Input area */}
            <div className="px-4 pb-4 pt-2" style={{ background: "var(--bg-subtle)" }}>
              <div
                className="flex items-end gap-2 rounded-xl px-4 py-2.5"
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                }}
              >
                <textarea
                  ref={inputRef}
                  rows={1}
                  className="flex-1 resize-none bg-transparent outline-none text-sm leading-relaxed"
                  style={{ color: "var(--text-h)", maxHeight: 120 }}
                  placeholder={newsMatches.length > 0 ? "뉴스에 대해 질문하세요..." : "뉴스를 불러오는 중..."}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    e.target.style.height = "auto";
                    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                  }}
                  onKeyDown={handleKeyDown}
                  disabled={chatLoading}
                />
                <button
                  onClick={() => sendMessage(input)}
                  disabled={chatLoading || !input.trim()}
                  className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                  style={{
                    background: input.trim() ? "var(--accent)" : "var(--border)",
                    color: "#fff",
                    opacity: chatLoading || !input.trim() ? 0.5 : 1,
                  }}
                >
                  <Send size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LinkAuditor;
