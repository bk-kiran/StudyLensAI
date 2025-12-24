import Link from "next/link";
import ReactMarkdown from "react-markdown";

interface MarkdownProps {
  children: string;
}

// Aggressive text formatter to break up dense blocks
function formatTextAggressively(text: string): string {
  let formatted = text;
  
  // Step 1: Convert numbered sections to headings (e.g., "1. Title" -> "## Title")
  formatted = formatted.replace(/^(\d+)\.\s+([A-Z][^\n]{10,100})$/gm, '## $2');
  
  // Step 2: Convert lettered subsections to subheadings (e.g., "a. Subtitle" -> "### Subtitle")
  formatted = formatted.replace(/^([a-z])\.\s+([A-Z][^\n]{5,80})$/gm, '### $2');
  
  // Step 3: Add double line breaks before lists
  formatted = formatted.replace(/([.!?])\s*\n\s*(\d+[.)]\s)/g, '$1\n\n$2');
  formatted = formatted.replace(/([.!?])\s*\n\s*([-*•]\s)/g, '$1\n\n$2');
  
  // Step 4: Ensure headings have proper spacing
  formatted = formatted.replace(/(#{1,6}\s+.+)\n([^\n#\s-*•\d])/g, '$1\n\n$2');
  
  // Step 5: Break up long paragraphs - split on sentence boundaries
  const lines = formatted.split('\n');
  const processedLines: string[] = [];
  
  for (const line of lines) {
    // Skip if it's already a heading, list item, or code block
    if (line.trim().match(/^(#{1,6}|[-*•]\s|\d+[.)]\s|[a-z]\.\s|```|`)/)) {
      processedLines.push(line);
      continue;
    }
    
    // If line is very long (> 250 chars) and has multiple sentences, try to break it
    if (line.length > 250) {
      // Count sentences (period/exclamation/question followed by space and capital letter)
      const sentenceMatches = line.match(/[.!?]\s+[A-Z]/g);
      const sentenceCount = sentenceMatches ? sentenceMatches.length : 0;
      
      if (sentenceCount >= 2) {
        // Split on sentence boundaries but keep the punctuation with the sentence
        const parts: string[] = [];
        let lastIndex = 0;
        
        // Find all sentence boundaries
        const regex = /([.!?]\s+)(?=[A-Z])/g;
        let match;
        while ((match = regex.exec(line)) !== null) {
          parts.push(line.substring(lastIndex, match.index + match[1].length));
          lastIndex = match.index + match[1].length;
        }
        if (lastIndex < line.length) {
          parts.push(line.substring(lastIndex));
        }
        
        // Group sentences into paragraphs (max 2-3 sentences per paragraph)
        let currentParagraph = '';
        let sentencesInParagraph = 0;
        
        for (const part of parts) {
          currentParagraph += part;
          if (part.match(/[.!?]\s*$/)) {
            sentencesInParagraph++;
          }
          
          // Break paragraph if it has 2-3 sentences or is getting long
          if (sentencesInParagraph >= 2 && currentParagraph.length > 150) {
            if (currentParagraph.trim()) {
              processedLines.push(currentParagraph.trim());
            }
            currentParagraph = '';
            sentencesInParagraph = 0;
          }
        }
        
        if (currentParagraph.trim()) {
          processedLines.push(currentParagraph.trim());
        }
        continue;
      }
    }
    
    processedLines.push(line);
  }
  
  // Step 6: Ensure paragraphs are separated by double line breaks
  formatted = processedLines.join('\n');
  formatted = formatted.replace(/([.!?])\s*\n\s*([A-Z][a-z])/g, (match, punct, next) => {
    // Only if not already double-spaced
    const index = formatted.indexOf(match);
    const before = formatted.substring(Math.max(0, index - 3), index);
    if (!before.endsWith('\n\n') && !before.match(/(#{1,6}|[-*•]|\d+[.)]|[a-z]\.)$/)) {
      return `${punct}\n\n${next}`;
    }
    return match;
  });
  
  // Step 7: Ensure code blocks have proper spacing (but don't auto-wrap - let AI handle it)
  // Just ensure existing code blocks have spacing
  formatted = formatted.replace(/([^\n])\n```/g, '$1\n\n```');
  formatted = formatted.replace(/```\n([^\n])/g, '```\n\n$1');
  
  return formatted;
}

export default function Markdown({ children }: MarkdownProps) {
  // Pre-process text to ensure proper paragraph breaks
  const processedText = typeof children === 'string' 
    ? formatTextAggressively(children)
    : children;

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:scroll-mt-4 break-words space-y-2">
      <ReactMarkdown
        components={{
          // Paragraphs with MUCH more spacing for readability
          p: ({ children }) => {
            const text = String(children);
            const isLong = text.length > 300;
            return (
              <div className={`mb-8 last:mb-0 ${isLong ? 'pb-2' : ''}`}>
                <p className="leading-8 text-foreground/90 text-[15px] break-words max-w-full">
                  {children}
                </p>
                {isLong && <div className="h-3" />}
              </div>
            );
          },
          // Headings with better hierarchy and spacing
          h1: ({ children }) => (
            <h1 className="text-2xl font-bold mb-6 mt-10 first:mt-0 text-foreground border-b border-border/50 pb-3 pt-2">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl font-semibold mb-5 mt-8 first:mt-0 text-foreground pt-1">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-semibold mb-4 mt-7 first:mt-0 text-foreground pt-1">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-base font-semibold mb-4 mt-6 first:mt-0 text-foreground">
              {children}
            </h4>
          ),
          // Lists with better spacing and visual clarity
          ul: ({ children }) => (
            <ul className="mb-7 ml-6 list-disc space-y-3.5 text-foreground/90 marker:text-primary/60">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-7 ml-6 list-decimal space-y-3.5 text-foreground/90 marker:font-semibold marker:text-primary/60">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="leading-7 text-[15px] pl-2.5 mb-1.5">
              {children}
            </li>
          ),
          // Enhanced code blocks with better styling
          code: ({ className, children, ...props }) => {
            const isInline = !className;
            return isInline ? (
              <code
                className="px-2 py-0.5 rounded-md bg-muted/80 text-[13px] font-mono text-primary border border-border/50 font-medium"
                {...props}
              >
                {children}
              </code>
            ) : (
              <code
                className="block p-0 rounded-lg bg-transparent text-sm font-mono overflow-x-auto mb-5 text-foreground"
                {...props}
              >
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="mb-5 overflow-x-auto rounded-lg bg-muted/60 p-4 border border-border/50 shadow-sm">
              {children}
            </pre>
          ),
          // Enhanced blockquotes with better visual distinction
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-primary/60 pl-5 py-2 my-5 italic text-foreground/80 bg-muted/30 rounded-r-lg">
              {children}
            </blockquote>
          ),
          // Links with better visibility
          a: ({ href, children }) => {
            const isInternalLink =
              href?.startsWith(process.env.NEXT_PUBLIC_BASE_URL!) ||
              href?.startsWith("/");
            if (isInternalLink) {
              return (
                <Link
                  href={href || "#"}
                  className="text-primary hover:text-primary/80 hover:underline font-medium transition-colors underline-offset-2"
                >
                  {children}
                </Link>
              );
            }
            return (
              <a
                href={href || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:text-primary/80 hover:underline font-medium transition-colors underline-offset-2"
              >
                {children}
              </a>
            );
          },
          // Enhanced horizontal rules with more spacing
          hr: () => <hr className="my-10 border-0 border-t-2 border-border/40" />,
          // Strong and emphasis with better visual weight
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-foreground/90">{children}</em>
          ),
          // Enhanced tables with better styling
          table: ({ children }) => (
            <div className="overflow-x-auto my-5 rounded-lg border border-border/50 shadow-sm">
              <table className="min-w-full border-collapse">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-muted/50">{children}</thead>
          ),
          tbody: ({ children }) => <tbody className="divide-y divide-border/50">{children}</tbody>,
          tr: ({ children }) => (
            <tr className="hover:bg-muted/30 transition-colors">{children}</tr>
          ),
          th: ({ children }) => (
            <th className="border-b border-border/50 px-4 py-3 text-left font-semibold text-foreground text-sm">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-3 text-foreground/90 text-sm">
              {children}
            </td>
          ),
        }}
      >
        {processedText}
      </ReactMarkdown>
    </div>
  );
}
