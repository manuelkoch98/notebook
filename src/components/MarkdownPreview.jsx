import { Fragment } from 'react';

function safeHref(href) {
  if (/^[a-z][a-z\d+.-]*:/i.test(href)) return /^(https?:|mailto:)/i.test(href) ? href : null;
  return href.startsWith('//') ? null : href;
}

function inline(text, onWiki) {
  const pattern = /(\[\[[^\]]+\]\]|!\[[^\]]*\]\([^\s)]+(?:\s+"[^"]*")?\)|\[[^\]]+\]\([^\s)]+(?:\s+"[^"]*")?\)|\*\*\*[^*]+\*\*\*|___[^_]+___|~~[^~]+~~|\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*]+\*|_[^_]+_)/g;
  return text.split(pattern).map((part, index) => {
    if (part.startsWith('[[')) {
      const [rawTarget, alias] = part.slice(2, -2).split('|');
      const title = rawTarget.split('#')[0];
      return <a href="#" key={index} onClick={event => { event.preventDefault(); onWiki?.(title); }}>{alias || title}</a>;
    }
    const image = part.match(/^!\[([^\]]*)\]\(([^\s)]+)(?:\s+"([^"]*)")?\)$/);
    if (image) { const href = safeHref(image[2]); return href ? <img key={index} src={href} alt={image[1]} title={image[3]} loading="lazy"/> : part; }
    const link = part.match(/^\[([^\]]+)\]\(([^\s)]+)(?:\s+"([^"]*)")?\)$/);
    if (link) { const href = safeHref(link[2]); return href ? <a key={index} href={href} title={link[3]} target={/^https?:/i.test(href) ? '_blank' : undefined} rel={/^https?:/i.test(href) ? 'noreferrer' : undefined}>{link[1]}</a> : part; }
    if (part.startsWith('***') || part.startsWith('___')) return <strong key={index}><em>{part.slice(3, -3)}</em></strong>;
    if (part.startsWith('**') || part.startsWith('__')) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('~~')) return <del key={index}>{part.slice(2, -2)}</del>;
    if (part.startsWith('`')) return <code key={index}>{part.slice(1, -1)}</code>;
    if (part.startsWith('*') || part.startsWith('_')) return <em key={index}>{part.slice(1, -1)}</em>;
    return <Fragment key={index}>{part}</Fragment>;
  });
}

function tableCells(line) {
  const source = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  const cells = []; let cell = '';
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '\\' && source[index + 1] === '|') { cell += '|'; index += 1; }
    else if (character === '|') { cells.push(cell.trim()); cell = ''; }
    else cell += character;
  }
  cells.push(cell.trim()); return cells;
}
function tableAlignment(cell) { return cell.startsWith(':') && cell.endsWith(':') ? 'center' : cell.endsWith(':') ? 'right' : 'left'; }
function isTableDivider(line) { const cells = tableCells(line); return cells.length > 0 && cells.every(cell => /^:?-{3,}:?$/.test(cell)); }
function isList(line) { return line.match(/^(\s*)([-+*]|\d+[.)])\s+(.+)$/); }
function calloutType(text) { return text.match(/^\[!(note|abstract|info|todo|tip|success|question|warning|failure|danger|bug|example|quote)\](?:\s+(.+))?$/i); }

export default function MarkdownPreview({ source, onWiki, onToggleTask }) {
  const lines = source.split('\n');
  const renderBlocks = (start = 0, end = lines.length) => {
    const blocks = []; let index = start;
    while (index < end) {
      const line = lines[index];
      if (!line.trim()) { index += 1; continue; }
      if (/^\s*(```|~~~)/.test(line)) {
        const fence = line.trim().slice(0, 3); const language = line.trim().slice(3).trim(); const code = [];
        index += 1; while (index < end && !lines[index].trimStart().startsWith(fence)) code.push(lines[index++]);
        if (index < end) index += 1;
        blocks.push(<pre key={`code-${start}-${index}`} data-language={language || undefined}><code>{code.join('\n')}</code></pre>); continue;
      }
      if (index + 1 < end && line.includes('|') && isTableDivider(lines[index + 1])) {
        const headers = tableCells(line); const aligns = tableCells(lines[index + 1]).map(tableAlignment); const rows = []; index += 2;
        while (index < end && lines[index].trim() && lines[index].includes('|')) rows.push(tableCells(lines[index++]));
        blocks.push(<div className="markdown-table-wrap" key={`table-${index}`}><table><thead><tr>{headers.map((cell, i) => <th key={i} style={{ textAlign: aligns[i] || 'left' }}>{inline(cell, onWiki)}</th>)}</tr></thead><tbody>{rows.map((row, ri) => <tr key={ri}>{headers.map((_, ci) => <td key={ci} style={{ textAlign: aligns[ci] || 'left' }}>{inline(row[ci] || '', onWiki)}</td>)}</tr>)}</tbody></table></div>); continue;
      }
      if (/^\s*(---+|___+|\*\*\*+)\s*$/.test(line)) { blocks.push(<hr key={`hr-${index++}`}/>); continue; }
      const listMatch = isList(line);
      if (listMatch) {
        const indent = listMatch[1].length; const ordered = /^\d/.test(listMatch[2]); const items = [];
        while (index < end) {
          const match = isList(lines[index]);
          if (!match || match[1].length < indent) break;
          if (match[1].length > indent) {
            const nested = renderBlocks(index, end);
            if (items.length) items[items.length - 1].children.push(...nested); break;
          }
          if (/^\d/.test(match[2]) !== ordered) break;
          const sourceLine = index; const task = match[3].match(/^\[([ xX])\]\s+(.*)$/); const children = [];
          if (task) children.push(<Fragment key={`task-${sourceLine}`}><input type="checkbox" checked={task[1].trim().length > 0} aria-label={task[2]} onChange={() => onToggleTask?.(sourceLine)}/><span>{inline(task[2], onWiki)}</span></Fragment>);
          else children.push(...inline(match[3], onWiki));
          items.push({ task: Boolean(task), children }); index += 1;
          if (index < end && isList(lines[index])?.[1].length > indent) {
            const nestedStart = index; while (index < end && isList(lines[index])?.[1].length > indent) index += 1;
            items[items.length - 1].children.push(...renderBlocks(nestedStart, index));
          }
        }
        const ListTag = ordered ? 'ol' : 'ul';
        blocks.push(<ListTag key={`list-${index}`} className={items.some(item => item.task) ? 'contains-task-list' : undefined}>{items.map((item, i) => <li key={i} className={item.task ? 'task-list-item' : undefined}>{item.children}</li>)}</ListTag>); continue;
      }
      if (/^>\s?/.test(line)) {
        const quoteLines = []; while (index < end && /^>\s?/.test(lines[index])) quoteLines.push(lines[index++].replace(/^>\s?/, ''));
        const marker = calloutType(quoteLines[0] || '');
        if (marker) {
          const title = marker[2] || marker[1].replace(/^./, c => c.toUpperCase()); const body = quoteLines.slice(1);
          blocks.push(<aside key={`callout-${index}`} className={`markdown-callout callout-${marker[1].toLowerCase()}`}><div className="markdown-callout-title">{title}</div>{body.length > 0 && <div>{body.map((text, i) => <p key={i}>{inline(text, onWiki)}</p>)}</div>}</aside>);
        } else blocks.push(<blockquote key={`quote-${index}`}>{quoteLines.map((text, i) => <p key={i}>{inline(text, onWiki)}</p>)}</blockquote>);
        continue;
      }
      const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
      if (heading) { const Tag = `h${heading[1].length}`; blocks.push(<Tag key={index}>{inline(heading[2], onWiki)}</Tag>); index += 1; continue; }
      const paragraph = [line]; index += 1;
      while (index < end && lines[index].trim() && !isList(lines[index]) && !/^#{1,6}\s/.test(lines[index]) && !/^>\s?/.test(lines[index]) && !/^\s*(```|~~~)/.test(lines[index])) paragraph.push(lines[index++]);
      blocks.push(<p key={`p-${index}`}>{paragraph.map((part, i) => <Fragment key={i}>{i > 0 && <br/>}{inline(part, onWiki)}</Fragment>)}</p>);
    }
    return blocks;
  };
  return <div className="markdown-preview">{renderBlocks()}</div>;
}
