import { Link } from 'react-router'
import { parseBlocks, parseInline } from '../utils/aiMessage'

function Inline({ text, onNavigate }) {
  return parseInline(text).map((part, index) => {
    if (part.type === 'link') {
      return (
        <Link key={index} to={part.href} onClick={onNavigate} className="font-semibold text-primary underline underline-offset-2 hover:text-white">
          {part.text}
        </Link>
      )
    }
    if (part.type === 'bold') return <strong key={index} className="font-semibold text-white">{part.text}</strong>
    return <span key={index}>{part.text}</span>
  })
}

// Plain-text rendering of the assistant's answer: no HTML is ever injected.
function AiMessageContent({ content, onNavigate }) {
  return (
    <div className="space-y-2 whitespace-pre-wrap break-words">
      {parseBlocks(content).map((block, index) => block.type === 'list' ? (
        <ul key={index} className="list-disc space-y-1 pl-5">
          {block.items.map((item, itemIndex) => <li key={itemIndex}><Inline text={item} onNavigate={onNavigate} /></li>)}
        </ul>
      ) : (
        <p key={index}><Inline text={block.text} onNavigate={onNavigate} /></p>
      ))}
    </div>
  )
}

export default AiMessageContent
