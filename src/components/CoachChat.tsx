import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
// @ts-ignore
import { apiClient } from '../api/client';
import GlassCard from './ui/GlassCard';
import {
    Brain,
    Send,
    Trash2,
    ChevronDown,
    ChevronRight,
    Loader2,
    Sparkles,
    Check,
    Plus
} from 'lucide-react';

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    thinking?: string;
}

interface SessionOption {
    id: number;
    date: string;
    duration_seconds: number;
    exercises: string[];
}

const CoachChat: React.FC = () => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isStreaming, setIsStreaming] = useState(false);
    const [sessions, setSessions] = useState<SessionOption[]>([]);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [showSessionPicker, setShowSessionPicker] = useState(false);
    const [expandedThinking, setExpandedThinking] = useState<Set<string>>(new Set());
    const chatEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        fetchSessions();
    }, []);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const fetchSessions = async () => {
        try {
            const res = await apiClient.get('/coach/sessions');
            if (Array.isArray(res)) {
                setSessions(res);
            }
        } catch (err) {
            console.error('Failed to fetch sessions:', err);
        }
    };

    const toggleSession = (id: number) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const toggleThinking = (msgId: string) => {
        setExpandedThinking(prev => {
            const next = new Set(prev);
            if (next.has(msgId)) next.delete(msgId);
            else next.add(msgId);
            return next;
        });
    };

    const deleteMessage = (msgId: string) => {
        setMessages(prev => prev.filter(m => m.id !== msgId));
    };

    const handleSend = async () => {
        if (!input.trim() || isStreaming) return;

        const question = input.trim();
        setInput('');

        const userMsg: ChatMessage = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: question,
        };
        const assistantMsg: ChatMessage = {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: '',
            thinking: '',
        };

        setMessages(prev => [...prev, userMsg, assistantMsg]);
        setIsStreaming(true);

        try {
            // Build message history (exclude current messages being sent)
            const history = messages.map(m => ({
                role: m.role,
                content: m.content,
                thinking: m.thinking || null,
            }));

            const token = localStorage.getItem('fitness_auth_token');
            const baseUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
            const response = await fetch(`${baseUrl}/coach/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    messages: history,
                    session_ids: selectedIds,
                    question,
                }),
            });

            if (!response.ok) throw new Error('Chat request failed');

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) throw new Error('No response stream');

            let accContent = '';
            let accThinking = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    try {
                        const data = JSON.parse(line.slice(6));
                        if (data.type === 'content') {
                            accContent += data.text;
                            setMessages(prev => prev.map(m =>
                                m.id === assistantMsg.id
                                    ? { ...m, content: accContent }
                                    : m
                            ));
                        } else if (data.type === 'thinking') {
                            accThinking += data.text;
                            setMessages(prev => prev.map(m =>
                                m.id === assistantMsg.id
                                    ? { ...m, thinking: accThinking }
                                    : m
                            ));
                        } else if (data.type === 'error') {
                            accContent += `\n\n⚠️ Error: ${data.text}`;
                            setMessages(prev => prev.map(m =>
                                m.id === assistantMsg.id
                                    ? { ...m, content: accContent }
                                    : m
                            ));
                        }
                    } catch {
                        // Skip malformed lines
                    }
                }
            }
        } catch (err: any) {
            setMessages(prev => prev.map(m =>
                m.id === assistantMsg.id
                    ? { ...m, content: `⚠️ Error: ${err.message}` }
                    : m
            ));
        } finally {
            setIsStreaming(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const formatDuration = (seconds: number) => {
        const min = Math.floor(seconds / 60);
        return `${min}m`;
    };

    return (
        <GlassCard className="p-0 overflow-hidden flex flex-col" style={{ minHeight: '500px' }}>
            {/* Header */}
            <div className="p-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Sparkles size={20} className="text-primary" />
                    <h3 className="text-lg font-bold text-text">AI Coach</h3>
                    <span className="text-xs text-muted bg-surface-highlight px-2 py-0.5 rounded-full">
                        qwen3:8b
                    </span>
                </div>
                <button
                    onClick={() => setShowSessionPicker(!showSessionPicker)}
                    className="text-xs flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-highlight hover:bg-border text-muted hover:text-text transition-colors border border-border"
                >
                    <Plus size={14} />
                    Context ({selectedIds.length})
                </button>
            </div>

            {/* Session Picker (collapsible) */}
            {showSessionPicker && (
                <div className="p-3 border-b border-border bg-surface/50 max-h-48 overflow-y-auto">
                    <p className="text-xs text-muted mb-2">Select workout sessions to include as context:</p>
                    {sessions.length === 0 ? (
                        <p className="text-xs text-muted italic">No workout sessions found.</p>
                    ) : (
                        <div className="space-y-1">
                            {sessions.map(s => (
                                <button
                                    key={s.id}
                                    onClick={() => toggleSession(s.id)}
                                    className={`w-full text-left text-xs p-2 rounded-lg flex items-center gap-2 transition-colors ${selectedIds.includes(s.id)
                                        ? 'bg-primary/15 text-primary border border-primary/30'
                                        : 'bg-surface-highlight hover:bg-border text-text border border-transparent'
                                        }`}
                                >
                                    <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${selectedIds.includes(s.id) ? 'bg-primary text-white' : 'border border-muted'
                                        }`}>
                                        {selectedIds.includes(s.id) && <Check size={10} />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <span className="font-medium">{s.date}</span>
                                        <span className="text-muted ml-2">({formatDuration(s.duration_seconds)})</span>
                                        <span className="text-muted ml-2 truncate">
                                            — {s.exercises.join(', ')}
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ minHeight: '250px', maxHeight: '500px' }}>
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center text-muted py-12">
                        <Brain size={40} className="mb-3 opacity-30" />
                        <p className="text-sm font-medium">Ask your AI Coach anything</p>
                        <p className="text-xs mt-1 max-w-xs">
                            Select workout sessions above for context, then ask for training advice, analysis, or recommendations.
                        </p>
                    </div>
                )}
                {messages.map(msg => (
                    <div
                        key={msg.id}
                        className={`group flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div className={`relative max-w-[85%] rounded-xl px-3 py-2 text-sm ${msg.role === 'user'
                            ? 'bg-primary text-white rounded-br-sm'
                            : 'bg-surface-highlight text-text rounded-bl-sm border border-border'
                            }`}>
                            {/* Thinking toggle */}
                            {msg.role === 'assistant' && msg.thinking && (
                                <button
                                    onClick={() => toggleThinking(msg.id)}
                                    className="flex items-center gap-1 text-xs text-muted hover:text-text mb-1 transition-colors"
                                >
                                    {expandedThinking.has(msg.id) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                    <Brain size={12} />
                                    <span>Thinking</span>
                                </button>
                            )}
                            {msg.role === 'assistant' && msg.thinking && expandedThinking.has(msg.id) && (
                                <div className="text-xs text-muted bg-surface/50 rounded-lg p-2 mb-2 border border-border/50 whitespace-pre-wrap max-h-48 overflow-y-auto">
                                    {msg.thinking}
                                </div>
                            )}

                            {/* Message content */}
                            <div className="break-words">
                                {msg.content ? (
                                    msg.role === 'assistant' ? (
                                        <div className="prose prose-sm prose-invert max-w-none [&_h1]:text-base [&_h1]:font-bold [&_h1]:mb-2 [&_h1]:mt-3 [&_h2]:text-sm [&_h2]:font-bold [&_h2]:mb-1.5 [&_h2]:mt-2 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mb-1 [&_h3]:mt-2 [&_p]:mb-1.5 [&_p]:leading-relaxed [&_ul]:mb-1.5 [&_ul]:pl-4 [&_ol]:mb-1.5 [&_ol]:pl-4 [&_li]:mb-0.5 [&_code]:bg-black/20 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_pre]:bg-black/20 [&_pre]:p-2 [&_pre]:rounded-lg [&_pre]:mb-2 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_strong]:font-bold [&_em]:italic [&_blockquote]:border-l-2 [&_blockquote]:border-muted [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-muted [&_table]:w-full [&_table]:text-xs [&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1 [&_th]:bg-black/10 [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_hr]:border-border [&_hr]:my-2">
                                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                                        </div>
                                    ) : (
                                        <span className="whitespace-pre-wrap">{msg.content}</span>
                                    )
                                ) : (msg.role === 'assistant' && isStreaming ? (
                                    <span className="flex items-center gap-1 text-muted">
                                        <Loader2 size={14} className="animate-spin" /> Thinking...
                                    </span>
                                ) : null)}
                            </div>

                            {/* Delete button */}
                            <button
                                onClick={() => deleteMessage(msg.id)}
                                className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-surface border border-border rounded-full p-1 hover:bg-red-500/20 hover:text-red-500 text-muted"
                                title="Delete message"
                            >
                                <Trash2 size={10} />
                            </button>
                        </div>
                    </div>
                ))}
                <div ref={chatEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-3 border-t border-border bg-surface/30">
                <div className="flex items-end gap-2">
                    <textarea
                        ref={inputRef}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask your coach..."
                        rows={1}
                        className="flex-1 resize-none p-2.5 rounded-xl bg-surface-highlight border border-border text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary placeholder-muted"
                        style={{ maxHeight: '120px' }}
                        disabled={isStreaming}
                    />
                    <button
                        onClick={handleSend}
                        disabled={isStreaming || !input.trim()}
                        className="p-2.5 rounded-xl bg-primary text-white hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                        {isStreaming ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                    </button>
                </div>
            </div>
        </GlassCard>
    );
};

export default CoachChat;
