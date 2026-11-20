import { Fragment } from 'react';

function inline(text, onWiki) {
  const pattern = /(\[\[[^\]]+\]\]|\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
  return text.split(pattern).map((part, index) => {
    if (part.startsWith('[[')) {
      const target = part.slice(2, -2).split('|');
      const title = target[0].split('#')[0];
      return <a href="#" key={index} onClick={event => { event.preventDefault(); onWiki(title); }}>{target[1] || title}</a>;
    }
    if (part.startsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`')) return <code key={index}>{part.slice(1, -1)}</code>;
    if (part.startsWith('*')) return <em key={index}>{part.slice(1, -1)}</em>;
    return <Fragment key={index}>{part}</Fragment>;
  });
}

export default function MarkdownPreview({ source, onWiki }) {
  const blocks = [];
  let list = [];
  const flush = () => { if (list.length) { blocks.push(<ul key={`list-${blocks.length}`}>{list}</ul>); list = []; } };
  source.split('\n').forEach((line, index) => {
    const item = line.match(/^\s*[-*+]\s+(.+)/);
    if (item) { list.push(<li key={index}>{inline(item[1], onWiki)}</li>); return; }
    flush();
    if (!line.trim()) return;
    const heading = line.match(/^(#{1,3})\s+(.+)/);
    if (heading) {
      const Tag = `h${heading[1].length}`;
      blocks.push(<Tag key={index}>{inline(heading[2], onWiki)}</Tag>);
    } else if (line.startsWith('> ')) blocks.push(<blockquote key={index}>{inline(line.slice(2), onWiki)}</blockquote>);
    else blocks.push(<p key={index}>{inline(line, onWiki)}</p>);
  });
  flush();
  return <div className="markdown-preview">{blocks}</div>;
}
