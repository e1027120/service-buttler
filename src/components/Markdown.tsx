import ReactMarkdown from 'react-markdown';

/** Safe markdown renderer (no raw HTML), links open in a new tab. */
export function Markdown({ children, className = '' }: { children?: string; className?: string }) {
  if (!children) return null;
  return (
    <div className={`prose-content ${className}`}>
      <ReactMarkdown
        components={{
          a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
