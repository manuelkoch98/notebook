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

function tableCells(line) {
  const source = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  const cells = [];
  let cell = '';
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '\\' && source[index + 1] === '|') { cell += '|'; index += 1; }
    else if (character === '|') { cells.push(cell.trim()); cell = ''; }
    else cell += character;
  }
  cells.push(cell.trim());
  return cells;
}

function tableAlignment(cell) {
  const left = cell.startsWith(':');
  const right = cell.endsWith(':');
  return left && right ? 'center' : right ? 'right' : 'left';
}

function isTableDivider(line) {
  const cells = tableCells(line);
  return cells.length > 0 && cells.every(cell => /^:?-{3,}:?$/.test(cell));
}

export default function MarkdownPreview({ source, onWiki, onToggleTask }) {
  const blocks = [];
  let list = [];
  const flush = () => { if (list.length) { blocks.push(<ul key={`list-${blocks.length}`}>{list}</ul>); list = []; } };
  const lines = source.split('\n');
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (line.includes('|') && index + 1 < lines.length && isTableDivider(lines[index + 1])) {
      flush();
      const headers = tableCells(line);
      const alignments = tableCells(lines[index + 1]).map(tableAlignment);
      const rows = [];
      let rowIndex = index + 2;
      while (rowIndex < lines.length && lines[rowIndex].trim() && lines[rowIndex].includes('|')) {
        rows.push(tableCells(lines[rowIndex]));
        rowIndex += 1;
      }
      blocks.push(<div className="markdown-table-wrap" key={`table-${index}`}><table><thead><tr>{headers.map((cell, cellIndex) => <th key={cellIndex} style={{ textAlign: alignments[cellIndex] || 'left' }}>{inline(cell, onWiki)}</th>)}</tr></thead><tbody>{rows.map((row, bodyIndex) => <tr key={bodyIndex}>{headers.map((_, cellIndex) => <td key={cellIndex} style={{ textAlign: alignments[cellIndex] || 'left' }}>{inline(row[cellIndex] || '', onWiki)}</td>)}</tr>)}</tbody></table></div>);
      index = rowIndex;
      continue;
    }
    const item = line.match(/^\s*[-*+]\s+(.+)/);
    if (item) {
      const task = item[1].match(/^\[([ xX])\]\s+(.*)$/);
      list.push(task
        ? <li key={index} className="task-list-item"><input type="checkbox" checked={task[1].trim().length > 0} aria-label={task[2]} onChange={() => onToggleTask?.(index)}/><span>{inline(task[2], onWiki)}</span></li>
        : <li key={index}>{inline(item[1], onWiki)}</li>);
      index += 1;
      continue;
    }
    flush();
    if (!line.trim()) { index += 1; continue; }
    const heading = line.match(/^(#{1,3})\s+(.+)/);
    if (heading) {
      const Tag = `h${heading[1].length}`;
      blocks.push(<Tag key={index}>{inline(heading[2], onWiki)}</Tag>);
    } else if (line.startsWith('> ')) blocks.push(<blockquote key={index}>{inline(line.slice(2), onWiki)}</blockquote>);
    else blocks.push(<p key={index}>{inline(line, onWiki)}</p>);
    index += 1;
  }
  flush();
  return <div className="markdown-preview">{blocks}</div>;
}
