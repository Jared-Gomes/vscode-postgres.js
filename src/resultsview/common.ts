import * as vscode from 'vscode';
import * as path from 'path';
import { QueryResults, FieldInfo } from '../common/database';
import { Global } from '../common/global';
import { formatFieldValue } from '../common/formatting';

export function disposeAll(disposables: vscode.Disposable[]) {
  while (disposables.length) {
    const item = disposables.pop();
    if (!item) continue;
    item.dispose();
  }
}

export function generateResultsHtml(
  webview: vscode.Webview,
  sourceUri: vscode.Uri,
  results: QueryResults[],
  state?: any,
) {
  let pageScript = getExtensionResourcePath('index.js', webview);
  const nonce = new Date().getTime() + '' + new Date().getMilliseconds();

  let html = `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta id="vscode-postgres-results-data"
        data-settings=""
        data-state="${JSON.stringify(state || {}).replace(/"/g, '&quot;')}" />
      <script src="${pageScript}" nonce="${nonce}"></script>
      ${getStyles(nonce)}
    </head>
    <body class="vscode-body">
      ${getResultsTables(results)}
    </body>
  </html>`;
  return html;
}

function getStyles(nonce) {
  let config = Global.Configuration;
  let prettyJsonFieldStyle = '';
  if (config.get<boolean>('prettyPrintJSONfields')) {
    prettyJsonFieldStyle = `
    .jsonb-field, .json-field {
      white-space: pre;
    }
    `;
  }
  return `<style nonce="${nonce}">
    body {
      margin: 0;
      padding: 0;
    }

    pre.vscode-postgres-result {
      margin: 5px;
    }
    
    pre.vscode-postgres-result-insert {
    
    }
    
    pre.vscode-postgres-result-update {
      
    }
    
    pre.vscode-postgres-result-create {
      
    }
    
    pre.vscode-postgres-result-delete {
      
    }
    
    pre.vscode-postgres-result-explain {
      
    }
    
    pre.vscode-postgres-result-generic {
      
    }
    
    pre.vscode-postgres-result-message {
      
    }

    pre.vscode-postgres-result-select {
      
    }

    .field-type {
      font-size: smaller;
    }

    ${prettyJsonFieldStyle}
    
    table {
      border-collapse: collapse;
    }

    thead th {
      position: sticky;
      top: -1px;
      background-color: var(--vscode-editor-background, var(--theme-background));
    }

    thead th::after {
      content: '';
      position: absolute;
      top: -1px;
      right: -1px;
      left: -1px;
      height: 100%;
      border: 1px solid var(--vscode-panel-border);
      pointer-events: none;
    }
    
    th, td {
      border-width: 1px;
      border-style: solid;
      border-color: var(--vscode-panel-border);
      padding: 3px 5px;
    }
    
    .timestamptz-field { white-space: nowrap; }

    .result-divider {
      padding: 0;
      border: none;
      border-top: medium double var(--vscode-panel-border);
    }
  </style>`;
}
function getExtensionResourcePath(
  mediaFile: string,
  webview: vscode.Webview,
): string {
  let filePath = path.join('media', mediaFile);
  let absFilePath = Global.context.asAbsolutePath(filePath);
  let uri = vscode.Uri.file(absFilePath);
  let url = webview.asWebviewUri(uri);
  return url.toString();
}

function getResultsTables(results: QueryResults[]): string {
  let html = '',
    first = true;
  for (const result of results) {
    if (!first) html += '<hr class="result-divider" />';
    switch (result.command) {
      case 'ext-message':
        html += generateMessage(result);
        break;
      case 'INSERT':
        html += generateInsertResults(result);
        break;
      case 'UPDATE':
        html += generateUpdateResults(result);
        break;
      case 'CREATE':
        html += generateCreateResults(result);
        break;
      case 'DELETE':
        html += generateDeleteResults(result);
        break;
      case 'EXPLAIN':
        html += generateExplainResult(result);
        break;
      case 'SELECT':
        html += generateSelectResult(result);
        break;
      default:
        html += generateGenericResult(result);
        break;
    }
    first = false;
  }
  return html;
}

function generateInsertResults(result: QueryResults): string {
  let html = getRowCountResult(result.rowCount, 'inserted', 'insert');
  if (
    result.fields &&
    result.fields.length &&
    result.rows &&
    result.rows.length
  )
    html += generateSelectTableResult(result);
  return html;
}

function generateUpdateResults(result: QueryResults): string {
  let html = getRowCountResult(result.rowCount, 'updated', 'update');
  if (
    result.fields &&
    result.fields.length &&
    result.rows &&
    result.rows.length
  )
    html += generateSelectTableResult(result);
  return html;
}

function generateCreateResults(result: QueryResults): string {
  return getRowCountResult(result.rowCount, 'created', 'create');
}

function generateDeleteResults(result: QueryResults): string {
  let html = getRowCountResult(result.rowCount, 'deleted', 'delete');
  if (
    result.fields &&
    result.fields.length &&
    result.rows &&
    result.rows.length
  )
    html += generateSelectTableResult(result);
  return html;
}

function getRowCountResult(
  rowCount: number,
  text: string,
  preClass: string,
): string {
  let rowOrRows = rowCount === 1 ? 'row' : 'rows';
  return `<pre class="vscode-postgres-result vscode-postgres-result-${preClass}">${rowCount} ${rowOrRows} ${text}</pre>`;
}

function generateExplainResult(result: QueryResults): string {
  return `<pre class="vscode-postgres-result vscode-postgres-result-explain">${result.rows.join('\n')}</pre>`;
}

function generateGenericResult(result: QueryResults): string {
  return `<pre class="vscode-postgres-result vscode-postgres-result-generic">${JSON.stringify(result)}</pre>`;
}

function generateMessage(result: QueryResults): string {
  return `<pre class="vscode-postgres-result vscode-postgres-result-message">${result.message}</pre>`;
}

function generateSelectResult(result: QueryResults): string {
  let html = getRowCountResult(result.rowCount, 'returned', 'select');
  html += generateSelectTableResult(result);
  return html;
}

function generateSelectTableResult(result: QueryResults): string {
  let html = `<table>`;
  // first the colum headers
  html += `<thead><tr><th></th>`;
  for (const field of result.fields) {
    html += `<th><div class="field-name">${field.name}</div><div class="field-type">${field.display_type}</div></th>`;
  }
  html += `</tr></thead>`;

  // now the body
  let rowIndex = 1;
  html += `<tbody>`;
  if (result.rows && result.rows.length) {
    for (const row of result.rows) {
      html += `<tr><th class="row-header">${rowIndex++}</th>`;
      result.fields.forEach((field, idx) => {
        let formatted = formatFieldValue(field, row[idx], false);
        html += `<td class="${field.format}-field">${formatted ? formatted : ''}</td>`;
      });
      html += `</tr>`;
    }
  }
  html += `</tbody>`;

  html += `</table>`;
  return html;
}

function base64Entities(str: string): string {
  let ret = atob(str);
  return ret;
}
