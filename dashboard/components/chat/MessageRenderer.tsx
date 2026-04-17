'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

import { Check, Copy } from 'lucide-react';
import React, { useState } from 'react';

function CodeBlock({ className, children, ...props }: any) {
    const [copied, setCopied] = useState(false);
    const match = /language-(\w+)/.exec(className || '');
    const language = match ? match[1] : '';
    const codeString = String(children).replace(/\n$/, '');

    // Inline code (no language class, short content)
    if (!className && !String(children).includes('\n')) {
        return (
            <code
                style={{
                    background: 'var(--accent-subtle)',
                    color: 'rgba(255, 255, 255, 0.85)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '0.875em',
                    fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
                    border: '1px solid var(--border-subtle)',
                }}
                {...props}
            >
                {children}
            </code>
        );
    }

    // Block code
    const handleCopy = async () => {
        await navigator.clipboard.writeText(codeString);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div
            style={{
                position: 'relative',
                borderRadius: '8px',
                overflow: 'hidden',
                margin: '12px 0',
                border: '1px solid var(--border-default)',
            }}
        >
            {/* Header bar with language label and copy button */}
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    background: 'var(--bg-elevated)',
                    borderBottom: '1px solid var(--border-subtle)',
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                    fontFamily: "'JetBrains Mono', monospace",
                }}
            >
                <span>{language || 'text'}</span>
                <button
                    onClick={handleCopy}
                    style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: copied ? 'var(--status-online)' : 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '12px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        transition: 'color 0.15s ease',
                    }}
                >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? 'Copied' : 'Copy'}
                </button>
            </div>

            {/* Code content */}
            <pre
                style={{
                    margin: 0,
                    padding: '14px 16px',
                    background: 'var(--bg-base)',
                    overflowX: 'auto',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    fontSize: '13px',
                    lineHeight: '1.6',
                    fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
                }}
            >
                <code className={className} {...props}>
                    {children}
                </code>
            </pre>
        </div>
    );
}

interface MessageRendererProps {
    content: string;
}

export const MessageRenderer = React.memo(function MessageRenderer({ content }: MessageRendererProps) {
    return (
        <div className="message-content w-full min-w-0 break-words font-normal">
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
                components={{
                    // Code (both inline and block)
                    code: CodeBlock as any,

                    // Blockquotes
                    blockquote: ({ children }) => (
                        <blockquote
                            className="my-3 first:mt-0 last:mb-0"
                            style={{
                                borderLeft: '3px solid var(--accent)',
                                padding: '8px 16px',
                                background: 'var(--accent-subtle)',
                                borderRadius: '0 6px 6px 0',
                                color: 'var(--text-secondary)',
                            }}
                        >
                            {children}
                        </blockquote>
                    ),

                    // Bold
                    strong: ({ children }) => (
                        <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                            {children}
                        </strong>
                    ),

                    // Paragraphs
                    p: ({ children }) => (
                        <p className="mb-3 last:mb-0 leading-snug" style={{ whiteSpace: 'pre-line' }}>{children}</p>
                    ),

                    // Links
                    a: ({ href, children }) => (
                        <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                color: 'var(--ofiere-cyan)',
                                textDecoration: 'underline',
                                textUnderlineOffset: '2px',
                            }}
                        >
                            {children}
                        </a>
                    ),

                    // Unordered lists
                    ul: ({ children }) => (
                        <ul className="mb-3 ml-6 list-disc list-outside space-y-0.5 marker:text-muted-foreground/80 last:mb-0">{children}</ul>
                    ),

                    // Ordered lists — preserve start attribute for correct numbering
                    ol: ({ node, children, ...props }: any) => {
                        const startAttr = node?.properties?.start;
                        return (
                            <ol
                                className="mb-3 ml-6 list-decimal list-outside space-y-0.5 marker:text-muted-foreground/80 last:mb-0"
                                start={startAttr ?? undefined}
                                {...props}
                            >
                                {children}
                            </ol>
                        );
                    },

                    // List items
                    li: ({ children }) => (
                        <li className="leading-snug">{children}</li>
                    ),

                    // Horizontal rules
                    hr: () => (
                        <hr
                            style={{
                                border: 'none',
                                borderTop: '1px solid var(--border-subtle)',
                                margin: '16px 0',
                            }}
                        />
                    ),

                    // Tables
                    table: ({ children }) => (
                        <div style={{ overflowX: 'auto', margin: '12px 0' }}>
                            <table
                                style={{
                                    width: '100%',
                                    borderCollapse: 'collapse',
                                    fontSize: '14px',
                                    border: '1px solid var(--border-default)',
                                    borderRadius: '8px',
                                    overflow: 'hidden',
                                }}
                            >
                                {children}
                            </table>
                        </div>
                    ),
                    th: ({ children }) => (
                        <th
                            style={{
                                padding: '10px 14px',
                                textAlign: 'left',
                                background: 'var(--bg-elevated)',
                                borderBottom: '1px solid var(--border-default)',
                                fontWeight: 600,
                                fontSize: '13px',
                            }}
                        >
                            {children}
                        </th>
                    ),
                    td: ({ children }) => (
                        <td
                            style={{
                                padding: '10px 14px',
                                borderBottom: '1px solid var(--border-subtle)',
                            }}
                        >
                            {children}
                        </td>
                    ),

                    // Headings
                    h1: ({ children }) => (
                        <h1 className="text-[1.3rem] font-black mt-5 mb-2.5 pb-1.5 border-b border-border/50 text-foreground first:mt-0 tracking-tight leading-tight block w-full">{children}</h1>
                    ),
                    h2: ({ children }) => (
                        <h2 className="text-[1.15rem] font-bold mt-4 mb-2 text-foreground first:mt-0 tracking-tight leading-tight block w-full">{children}</h2>
                    ),
                    h3: ({ children }) => (
                        <h3 className="text-[1rem] font-semibold mt-3 mb-1.5 text-foreground/90 first:mt-0 leading-snug block w-full">{children}</h3>
                    ),
                }}
                // Pre-process any escaped newlines if needed, though react-markdown handles regular newlines.
                children={content.replace(/\\n/g, '\n')}
            />
        </div>
    );
});
