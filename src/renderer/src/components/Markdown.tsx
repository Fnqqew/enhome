import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// Markdown seguro: react-markdown no interpreta HTML crudo. Los links se abren fuera de la app.
export default function Markdown({ markdown }: { markdown: string }): React.JSX.Element {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noreferrer" />
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  )
}
